import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  SOCIAL_CONNECTION_STATES,
  SOCIAL_DATA_SOURCES,
  SOCIAL_ERROR_CODES,
  SOCIAL_MEDIA_CONTRACT_VERSION,
  SOCIAL_PROVIDER_IDS,
  createAttributionEvent,
  createCampaignDescriptor,
  createMarketingAnalyticsSnapshot,
  createSocialIntegrationError,
  createSocialProviderStatus
} from "../social-media/contracts/social-media-contract.js";
import {
  createInstagramSampleSnapshot,
  fetchInstagramBusinessSnapshot,
  getInstagramBusinessProviderStatus,
  getInstagramRuntimeStatus
} from "../social-media/providers/instagram-business-provider.js";
import {
  INSTAGRAM_MINIMUM_ANALYTICS_PERMISSIONS,
  INSTAGRAM_RUNTIME_ENVIRONMENT,
  publicInstagramRuntimeStatus,
  validateInstagramRuntimeEnvironment
} from "../social-media/infrastructure/instagram-runtime-controls.js";
import {
  META_INSTAGRAM_OAUTH_ENDPOINTS,
  completeMetaInstagramOAuthConnection,
  createMetaInstagramAuthorizationUrl,
  createMetaInstagramOAuthState,
  exchangeMetaInstagramAuthorizationCode,
  exchangeMetaInstagramLongLivedToken,
  refreshMetaInstagramLongLivedToken,
  shouldRefreshMetaInstagramToken,
  verifyMetaInstagramOAuthState,
  verifyMetaInstagramToken
} from "../social-media/infrastructure/meta-instagram-oauth-workflow.js";
import {
  getSupportedSocialProvider,
  listSupportedSocialProviders
} from "../social-media/providers/social-provider-registry.js";
import {
  createMockFounderMarketingAnalytics,
  createSocialMediaMarketingAnalytics
} from "../social-media/social-media-analytics-service.js";

test("social media provider status uses versioned contract and default false capabilities", () => {
  const status = createSocialProviderStatus({
    provider: SOCIAL_PROVIDER_IDS.INSTAGRAM,
    state: SOCIAL_CONNECTION_STATES.MOCK_SAMPLE,
    source: SOCIAL_DATA_SOURCES.MOCK_SAMPLE,
    accountHandle: "@prometheus.iq",
    checkedAt: "2026-06-30T12:00:00.000Z"
  });

  assert.equal(status.contractVersion, SOCIAL_MEDIA_CONTRACT_VERSION);
  assert.equal(status.provider, SOCIAL_PROVIDER_IDS.INSTAGRAM);
  assert.equal(status.capabilities.read_account_insights, false);
  assert.equal(status.accountHandle, "@prometheus.iq");
});

test("social media contract exposes required safe Instagram runtime states", () => {
  const states = Object.values(SOCIAL_CONNECTION_STATES);

  assert.equal(states.includes("not_configured"), true);
  assert.equal(states.includes("configured"), true);
  assert.equal(states.includes("permission_required"), true);
  assert.equal(states.includes("token_missing"), true);
  assert.equal(states.includes("token_expired"), true);
  assert.equal(states.includes("verification_pending"), true);
  assert.equal(states.includes("connected"), true);
  assert.equal(states.includes("error"), true);
});

test("frontend code does not import backend Instagram runtime controls or token env names", () => {
  const frontendFiles = ["index.html", "deploy/cloudflare-pages/index.html", "src/main.jsx", "landing.html"];
  const forbidden = [
    "instagram-runtime-controls",
    "INSTAGRAM_ACCESS_TOKEN",
    "META_INSTAGRAM_ACCESS_TOKEN",
    "META_APP_SECRET",
    "INSTAGRAM_GRANTED_SCOPES"
  ];

  for (const file of frontendFiles) {
    const content = readFileSync(file, "utf8");
    for (const pattern of forbidden) {
      assert.equal(content.includes(pattern), false, `${file} must not expose ${pattern}`);
    }
  }
});

test("social media errors redact credential-like fields recursively", () => {
  const error = createSocialIntegrationError({
    code: SOCIAL_ERROR_CODES.PROVIDER_ERROR,
    message: "Provider failed.",
    details: {
      accessToken: "must-not-leak",
      nested: {
        app_secret: "also-secret",
        safe: "visible"
      }
    }
  });

  assert.equal(error.details.accessToken, "[redacted]");
  assert.equal(error.details.nested.app_secret, "[redacted]");
  assert.equal(error.details.nested.safe, "visible");
});

test("campaigns and attribution events normalize Website, CRM, beta, founder, and campaign targets", () => {
  const campaign = createCampaignDescriptor({
    id: "beta-route-iq-awareness-v1",
    name: "Route IQ Beta Awareness",
    startsAt: "2026-06-01T00:00:00-05:00",
    utm: {
      source: "instagram",
      medium: "social"
    }
  });
  const event = createAttributionEvent({
    id: "evt_1",
    type: "crm_lead_created",
    target: "crm_lead",
    source: SOCIAL_DATA_SOURCES.MOCK_SAMPLE,
    campaignId: campaign.id,
    occurredAt: "2026-06-30T10:00:00-05:00",
    confidence: 2
  });

  assert.equal(campaign.utm.campaign, "beta-route-iq-awareness-v1");
  assert.equal(event.target, "crm_lead");
  assert.equal(event.confidence, 1);
});

test("marketing analytics snapshot labels samples and keeps normalized records together", () => {
  const snapshot = createMarketingAnalyticsSnapshot({
    id: "snapshot_1",
    generatedAt: "2026-06-30T12:00:00.000Z",
    providers: [{
      provider: SOCIAL_PROVIDER_IDS.INSTAGRAM,
      checkedAt: "2026-06-30T12:00:00.000Z"
    }],
    campaigns: [{
      id: "campaign_1",
      name: "Campaign 1"
    }],
    metrics: [{
      name: "reach",
      value: "5",
      observedAt: "2026-06-30T12:00:00.000Z"
    }]
  });

  assert.equal(snapshot.contractVersion, SOCIAL_MEDIA_CONTRACT_VERSION);
  assert.equal(snapshot.providers[0].state, SOCIAL_CONNECTION_STATES.DISCONNECTED);
  assert.equal(snapshot.metrics[0].value, 5);
});

test("provider registry includes every planned provider and rejects unsupported rebuilding paths", () => {
  const providers = listSupportedSocialProviders();
  const ids = providers.map(provider => provider.id).sort();

  assert.deepEqual(ids, ["facebook", "instagram", "linkedin", "tiktok", "x", "youtube"]);
  assert.equal(getSupportedSocialProvider("instagram").unsupported.includes("scraping"), true);
  assert.equal(getSupportedSocialProvider("instagram").unsupported.includes("live_posting"), true);
});

test("Instagram Business provider returns mock sample state without credentials", () => {
  const status = getInstagramBusinessProviderStatus({
    env: {},
    checkedAt: "2026-06-30T12:00:00.000Z"
  });
  const snapshot = createInstagramSampleSnapshot({
    generatedAt: "2026-06-30T12:00:00.000Z"
  });

  assert.equal(status.state, SOCIAL_CONNECTION_STATES.NOT_CONFIGURED);
  assert.equal(status.errors[0].details.missingSetup.includes("META_APP_ID"), true);
  assert.equal(snapshot.providers[0].state, SOCIAL_CONNECTION_STATES.NOT_CONFIGURED);
  assert.equal(snapshot.metrics[0].source, SOCIAL_DATA_SOURCES.MOCK_SAMPLE);
});

test("Instagram runtime controls classify safe placeholder states", () => {
  const setupEnv = {
    META_APP_ID: "app-id",
    META_APP_SECRET: "app-secret-not-returned",
    META_OAUTH_CALLBACK_URL: "https://prometheusrouteiq.com/api/oauth/meta/instagram/callback",
    INSTAGRAM_BUSINESS_ACCOUNT_ID: "17890000000000000",
    META_GRAPH_API_VERSION: "v21.0"
  };
  const scopedEnv = {
    ...setupEnv,
    INSTAGRAM_ACCESS_TOKEN: "token-not-returned",
    INSTAGRAM_GRANTED_SCOPES: INSTAGRAM_MINIMUM_ANALYTICS_PERMISSIONS.join(",")
  };

  assert.equal(validateInstagramRuntimeEnvironment({ env: {} }).state, SOCIAL_CONNECTION_STATES.NOT_CONFIGURED);
  assert.equal(validateInstagramRuntimeEnvironment({ env: setupEnv }).state, SOCIAL_CONNECTION_STATES.TOKEN_MISSING);
  assert.equal(validateInstagramRuntimeEnvironment({
    env: {
      ...setupEnv,
      INSTAGRAM_ACCESS_TOKEN: "token-not-returned",
      INSTAGRAM_TOKEN_EXPIRES_AT: "2026-06-29T00:00:00.000Z"
    },
    now: new Date("2026-06-30T00:00:00.000Z")
  }).state, SOCIAL_CONNECTION_STATES.TOKEN_EXPIRED);
  assert.equal(validateInstagramRuntimeEnvironment({
    env: {
      ...setupEnv,
      INSTAGRAM_ACCESS_TOKEN: "token-not-returned",
      INSTAGRAM_GRANTED_SCOPES: "instagram_basic"
    }
  }).state, SOCIAL_CONNECTION_STATES.PERMISSION_REQUIRED);
  assert.equal(validateInstagramRuntimeEnvironment({ env: scopedEnv }).state, SOCIAL_CONNECTION_STATES.VERIFICATION_PENDING);
  assert.equal(validateInstagramRuntimeEnvironment({
    env: {
      ...scopedEnv,
      INSTAGRAM_CONNECTION_VERIFIED_AT: "2026-06-30T12:00:00.000Z"
    }
  }).state, SOCIAL_CONNECTION_STATES.CONNECTED);

  const invalid = validateInstagramRuntimeEnvironment({
    env: {
      ...setupEnv,
      META_OAUTH_CALLBACK_URL: "http://localhost/callback"
    }
  });
  assert.equal(invalid.state, SOCIAL_CONNECTION_STATES.ERROR);

  const publicStatus = publicInstagramRuntimeStatus(validateInstagramRuntimeEnvironment({ env: scopedEnv }));
  assert.equal(JSON.stringify(publicStatus).includes("token-not-returned"), false);
  assert.equal(JSON.stringify(publicStatus).includes("app-secret-not-returned"), false);
  assert.equal(getInstagramRuntimeStatus({ env: scopedEnv }).state, SOCIAL_CONNECTION_STATES.VERIFICATION_PENDING);
  assert.equal(INSTAGRAM_RUNTIME_ENVIRONMENT.META_APP_SECRET, "META_APP_SECRET");
});

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body;
    }
  };
}

function createOrderedFetch(responses) {
  const calls = [];
  const fetchImpl = async (input, init = {}) => {
    calls.push({ url: String(input), init });
    const next = responses.shift();
    assert.ok(next, `unexpected fetch call: ${String(input)}`);
    if (typeof next.assert === "function") next.assert(String(input), init);
    return jsonResponse(next.status || 200, next.body || {});
  };
  fetchImpl.calls = calls;
  return fetchImpl;
}

const metaOAuthEnv = {
  META_APP_ID: "meta-app-id",
  META_APP_SECRET: "meta-app-secret-not-returned",
  META_OAUTH_STATE_SECRET: "oauth-state-secret-not-returned",
  META_OAUTH_CALLBACK_URL: "https://prometheusrouteiq.com/api/oauth/meta/instagram/callback",
  INSTAGRAM_BUSINESS_ACCOUNT_ID: "17890000000000000",
  INSTAGRAM_OAUTH_SCOPES: INSTAGRAM_MINIMUM_ANALYTICS_PERMISSIONS.join(","),
  META_GRAPH_API_VERSION: "v21.0"
};

test("Meta Instagram OAuth workflow creates signed authorization URLs without exposing secrets", () => {
  const state = createMetaInstagramOAuthState({
    env: metaOAuthEnv,
    now: "2026-06-30T12:00:00.000Z",
    nonce: "nonce-1"
  });
  const verified = verifyMetaInstagramOAuthState({
    env: metaOAuthEnv,
    state: state.state,
    now: "2026-06-30T12:01:00.000Z"
  });
  const authorization = createMetaInstagramAuthorizationUrl({
    env: metaOAuthEnv,
    state: state.state
  });
  const tampered = verifyMetaInstagramOAuthState({
    env: metaOAuthEnv,
    state: `${state.state}x`,
    now: "2026-06-30T12:01:00.000Z"
  });

  assert.equal(state.ok, true);
  assert.equal(verified.ok, true);
  assert.equal(verified.payload.nonce, "nonce-1");
  assert.equal(authorization.ok, true);
  assert.equal(authorization.url.startsWith(META_INSTAGRAM_OAUTH_ENDPOINTS.AUTHORIZE), true);
  assert.equal(authorization.url.includes("meta-app-secret-not-returned"), false);
  assert.equal(tampered.ok, false);
});

test("Meta Instagram OAuth exchanges authorization code for short and long lived tokens through official endpoints", async () => {
  const fetchImpl = createOrderedFetch([
    {
      assert: (url, init) => {
        assert.equal(url, META_INSTAGRAM_OAUTH_ENDPOINTS.SHORT_LIVED_TOKEN);
        assert.equal(init.method, "POST");
        assert.equal(String(init.body).includes("authorization_code"), true);
      },
      body: {
        access_token: "short-lived-token-not-public",
        user_id: "ig-user-1",
        permissions: INSTAGRAM_MINIMUM_ANALYTICS_PERMISSIONS
      }
    },
    {
      assert: url => {
        assert.ok(url.startsWith(META_INSTAGRAM_OAUTH_ENDPOINTS.LONG_LIVED_TOKEN));
        assert.ok(url.includes("ig_exchange_token"));
      },
      body: {
        access_token: "long-lived-token-not-public",
        token_type: "bearer",
        expires_in: 5184000
      }
    }
  ]);

  const shortToken = await exchangeMetaInstagramAuthorizationCode({
    env: metaOAuthEnv,
    fetchImpl,
    code: "oauth-code"
  });
  const longToken = await exchangeMetaInstagramLongLivedToken({
    env: metaOAuthEnv,
    fetchImpl,
    shortLivedAccessToken: shortToken.accessToken,
    now: "2026-06-30T12:00:00.000Z"
  });

  assert.equal(shortToken.ok, true);
  assert.equal(shortToken.accessToken, "short-lived-token-not-public");
  assert.equal(JSON.stringify(shortToken.providerResponse).includes("short-lived-token-not-public"), false);
  assert.equal(longToken.ok, true);
  assert.equal(longToken.expiresAt, "2026-08-29T12:00:00.000Z");
});

test("Meta Instagram OAuth refreshes long-lived tokens and verifies account identity", async () => {
  const fetchImpl = createOrderedFetch([
    {
      assert: url => {
        assert.ok(url.startsWith(META_INSTAGRAM_OAUTH_ENDPOINTS.REFRESH_LONG_LIVED_TOKEN));
        assert.ok(url.includes("ig_refresh_token"));
      },
      body: {
        access_token: "refreshed-token-not-public",
        token_type: "bearer",
        expires_in: 5184000
      }
    },
    {
      assert: url => {
        assert.ok(url.startsWith(META_INSTAGRAM_OAUTH_ENDPOINTS.ME));
        assert.ok(url.includes("fields=user_id"));
      },
      body: {
        user_id: "ig-user-1",
        username: "prometheus.iq",
        account_type: "BUSINESS"
      }
    }
  ]);

  const refreshed = await refreshMetaInstagramLongLivedToken({
    env: {
      ...metaOAuthEnv,
      INSTAGRAM_ACCESS_TOKEN: "existing-token-not-public"
    },
    fetchImpl,
    now: "2026-06-30T12:00:00.000Z"
  });
  const verified = await verifyMetaInstagramToken({
    env: metaOAuthEnv,
    fetchImpl,
    accessToken: refreshed.accessToken,
    now: "2026-06-30T12:00:00.000Z"
  });

  assert.equal(refreshed.ok, true);
  assert.equal(refreshed.expiresAt, "2026-08-29T12:00:00.000Z");
  assert.equal(verified.ok, true);
  assert.equal(verified.instagramUser.username, "prometheus.iq");
});

test("Meta Instagram OAuth connection workflow returns backend env patch and redacted public status", async () => {
  const state = createMetaInstagramOAuthState({
    env: metaOAuthEnv,
    now: "2026-06-30T12:00:00.000Z",
    nonce: "nonce-2"
  });
  const fetchImpl = createOrderedFetch([
    {
      body: {
        access_token: "short-lived-token-not-public",
        user_id: "ig-user-1",
        permissions: INSTAGRAM_MINIMUM_ANALYTICS_PERMISSIONS
      }
    },
    {
      body: {
        access_token: "long-lived-token-not-public",
        token_type: "bearer",
        expires_in: 5184000
      }
    },
    {
      body: {
        user_id: "ig-user-1",
        username: "prometheus.iq",
        account_type: "BUSINESS"
      }
    }
  ]);

  const result = await completeMetaInstagramOAuthConnection({
    env: metaOAuthEnv,
    fetchImpl,
    code: "oauth-code",
    state: state.state,
    now: "2026-06-30T12:00:00.000Z"
  });

  assert.equal(result.ok, true);
  assert.equal(result.envPatch.INSTAGRAM_ACCESS_TOKEN, "long-lived-token-not-public");
  assert.equal(result.envPatch.INSTAGRAM_CONNECTION_VERIFIED_AT, "2026-06-30T12:00:00.000Z");
  assert.equal(result.envPatch.INSTAGRAM_ACCOUNT_HANDLE, "@prometheus.iq");
  assert.equal(JSON.stringify(result.safeStatus).includes("long-lived-token-not-public"), false);
  assert.equal(JSON.stringify(result.safeStatus).includes("meta-app-secret-not-returned"), false);
});

test("Meta Instagram token refresh planning uses runtime expiration metadata", () => {
  const outsideWindow = shouldRefreshMetaInstagramToken({
    env: {
      ...metaOAuthEnv,
      INSTAGRAM_ACCESS_TOKEN: "existing-token-not-public",
      INSTAGRAM_TOKEN_EXPIRES_AT: "2026-08-29T12:00:00.000Z"
    },
    now: "2026-06-30T12:00:00.000Z"
  });
  const insideWindow = shouldRefreshMetaInstagramToken({
    env: {
      ...metaOAuthEnv,
      INSTAGRAM_ACCESS_TOKEN: "existing-token-not-public",
      INSTAGRAM_TOKEN_EXPIRES_AT: "2026-07-02T12:00:00.000Z"
    },
    now: "2026-06-30T12:00:00.000Z"
  });

  assert.equal(outsideWindow.shouldRefresh, false);
  assert.equal(insideWindow.shouldRefresh, true);
});

test("Instagram Business provider maps mocked Meta API responses without exposing tokens", async () => {
  const fetchCalls = [];
  const authHeaders = [];
  const fetchImpl = async (url, init = {}) => {
    fetchCalls.push(String(url));
    authHeaders.push(init.headers?.Authorization || "");
    const path = String(url);
    if (path.includes("/insights")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            { name: "reach", values: [{ value: 12 }] },
            { name: "profile_views", values: [{ value: 4 }] },
            { name: "website_clicks", values: [{ value: 2 }] }
          ]
        })
      };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        username: "prometheus.iq",
        followers_count: 50,
        media_count: 7
      })
    };
  };

  const snapshot = await fetchInstagramBusinessSnapshot({
    env: {
      INSTAGRAM_ACCESS_TOKEN: "test-token-not-returned",
      INSTAGRAM_BUSINESS_ACCOUNT_ID: "17890000000000000",
      META_APP_ID: "app-id",
      META_APP_SECRET: "app-secret-not-returned",
      META_OAUTH_CALLBACK_URL: "https://prometheusrouteiq.com/api/oauth/meta/instagram/callback",
      META_GRAPH_API_VERSION: "v21.0",
      INSTAGRAM_GRANTED_SCOPES: INSTAGRAM_MINIMUM_ANALYTICS_PERMISSIONS.join(","),
      INSTAGRAM_CONNECTION_VERIFIED_AT: "2026-06-30T12:00:00.000Z"
    },
    fetchImpl,
    generatedAt: "2026-06-30T12:00:00.000Z"
  });

  assert.equal(snapshot.providers[0].state, SOCIAL_CONNECTION_STATES.CONNECTED);
  assert.equal(snapshot.providers[0].accountHandle, "@prometheus.iq");
  assert.equal(snapshot.metrics.find(metric => metric.name === "reach").value, 12);
  assert.equal(JSON.stringify(snapshot).includes("test-token-not-returned"), false);
  assert.equal(JSON.stringify(snapshot).includes("app-secret-not-returned"), false);
  assert.equal(fetchCalls.some(url => url.includes("test-token-not-returned")), false);
  assert.equal(authHeaders.every(header => header === "Bearer test-token-not-returned"), true);
  assert.equal(fetchCalls.length, 2);
});

test("Social Media analytics service aggregates attribution summary without downstream code changes", () => {
  const snapshot = createSocialMediaMarketingAnalytics({
    generatedAt: "2026-06-30T12:00:00.000Z",
    campaigns: [{
      id: "campaign_1",
      name: "Campaign 1"
    }],
    metrics: [{
      name: "website_clicks",
      value: 3,
      observedAt: "2026-06-30T12:00:00.000Z"
    }],
    attributionEvents: [{
      id: "event_1",
      type: "website_visit",
      target: "website_traffic",
      source: SOCIAL_DATA_SOURCES.MOCK_SAMPLE,
      occurredAt: "2026-06-30T12:00:00.000Z"
    }]
  });
  const founderSample = createMockFounderMarketingAnalytics({
    generatedAt: "2026-06-30T12:00:00.000Z"
  });

  assert.equal(snapshot.summary.websiteVisitsAttributed, 1);
  assert.equal(snapshot.summary.totalWebsiteClicks, 3);
  assert.equal(founderSample.summary.crmLeadsAttributed, 1);
  assert.equal(founderSample.summary.betaEventsAttributed, 1);
});
