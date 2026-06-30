import {
  SOCIAL_CONNECTION_STATES,
  SOCIAL_DATA_SOURCES,
  SOCIAL_PROVIDER_CAPABILITIES,
  SOCIAL_PROVIDER_IDS,
  createSocialProviderStatus
} from "../contracts/social-media-contract.js";

export const SUPPORTED_SOCIAL_PROVIDERS = Object.freeze({
  [SOCIAL_PROVIDER_IDS.INSTAGRAM]: {
    id: SOCIAL_PROVIDER_IDS.INSTAGRAM,
    displayName: "Instagram Business",
    apiStrategy: "Meta Graph API with Instagram Business/Professional account insights",
    setupOwner: "Prometheus Social Media with backend secret storage from Infrastructure",
    requiredSetup: [
      "Meta Developer app",
      "Instagram professional or business account",
      "Connected Facebook Page when using Instagram API with Facebook Login",
      "Backend-only access token storage",
      "App Review approval for production permissions when required"
    ],
    supportedCapabilities: [
      SOCIAL_PROVIDER_CAPABILITIES.READ_ACCOUNT_INSIGHTS,
      SOCIAL_PROVIDER_CAPABILITIES.READ_CONTENT_INSIGHTS,
      SOCIAL_PROVIDER_CAPABILITIES.READ_AUDIENCE_INSIGHTS,
      SOCIAL_PROVIDER_CAPABILITIES.READ_COMMENT_SUMMARY
    ],
    unsupported: ["password_login", "scraping", "browser_automation", "live_posting"]
  },
  [SOCIAL_PROVIDER_IDS.FACEBOOK]: {
    id: SOCIAL_PROVIDER_IDS.FACEBOOK,
    displayName: "Facebook Page",
    apiStrategy: "Meta Graph API Page insights",
    setupOwner: "Prometheus Social Media with Integrations/Infrastructure handoff",
    requiredSetup: ["Meta app", "Facebook Page", "Page token", "approved read insights permissions"],
    supportedCapabilities: [
      SOCIAL_PROVIDER_CAPABILITIES.READ_ACCOUNT_INSIGHTS,
      SOCIAL_PROVIDER_CAPABILITIES.READ_CONTENT_INSIGHTS,
      SOCIAL_PROVIDER_CAPABILITIES.READ_AUDIENCE_INSIGHTS
    ],
    unsupported: ["password_login", "scraping", "browser_automation", "live_posting"]
  },
  [SOCIAL_PROVIDER_IDS.LINKEDIN]: {
    id: SOCIAL_PROVIDER_IDS.LINKEDIN,
    displayName: "LinkedIn",
    apiStrategy: "LinkedIn Marketing API and Organization analytics",
    setupOwner: "Future Prometheus Integrations handoff",
    requiredSetup: ["LinkedIn Developer app", "organization access", "approved analytics products"],
    supportedCapabilities: [
      SOCIAL_PROVIDER_CAPABILITIES.READ_ACCOUNT_INSIGHTS,
      SOCIAL_PROVIDER_CAPABILITIES.READ_CONTENT_INSIGHTS,
      SOCIAL_PROVIDER_CAPABILITIES.READ_CAMPAIGN_INSIGHTS
    ],
    unsupported: ["password_login", "scraping", "browser_automation", "live_posting"]
  },
  [SOCIAL_PROVIDER_IDS.X]: {
    id: SOCIAL_PROVIDER_IDS.X,
    displayName: "X",
    apiStrategy: "X API analytics where account tier and API product allow it",
    setupOwner: "Future Prometheus Integrations handoff",
    requiredSetup: ["X Developer project", "approved API access", "backend-only OAuth token handling"],
    supportedCapabilities: [
      SOCIAL_PROVIDER_CAPABILITIES.READ_ACCOUNT_INSIGHTS,
      SOCIAL_PROVIDER_CAPABILITIES.READ_CONTENT_INSIGHTS
    ],
    unsupported: ["password_login", "scraping", "browser_automation", "live_posting"]
  },
  [SOCIAL_PROVIDER_IDS.TIKTOK]: {
    id: SOCIAL_PROVIDER_IDS.TIKTOK,
    displayName: "TikTok",
    apiStrategy: "TikTok for Developers or TikTok Business APIs",
    setupOwner: "Future Prometheus Integrations handoff",
    requiredSetup: ["TikTok developer app", "business account access where required", "approved analytics scopes"],
    supportedCapabilities: [
      SOCIAL_PROVIDER_CAPABILITIES.READ_ACCOUNT_INSIGHTS,
      SOCIAL_PROVIDER_CAPABILITIES.READ_CONTENT_INSIGHTS,
      SOCIAL_PROVIDER_CAPABILITIES.READ_AUDIENCE_INSIGHTS
    ],
    unsupported: ["password_login", "scraping", "browser_automation", "live_posting"]
  },
  [SOCIAL_PROVIDER_IDS.YOUTUBE]: {
    id: SOCIAL_PROVIDER_IDS.YOUTUBE,
    displayName: "YouTube",
    apiStrategy: "YouTube Data API plus YouTube Analytics API",
    setupOwner: "Future Prometheus Integrations handoff",
    requiredSetup: ["Google Cloud project", "YouTube channel authorization", "backend-only OAuth token handling"],
    supportedCapabilities: [
      SOCIAL_PROVIDER_CAPABILITIES.READ_ACCOUNT_INSIGHTS,
      SOCIAL_PROVIDER_CAPABILITIES.READ_CONTENT_INSIGHTS,
      SOCIAL_PROVIDER_CAPABILITIES.READ_AUDIENCE_INSIGHTS
    ],
    unsupported: ["password_login", "scraping", "browser_automation", "live_posting"]
  }
});

export function listSupportedSocialProviders() {
  return Object.values(SUPPORTED_SOCIAL_PROVIDERS).map(provider => ({
    ...provider,
    requiredSetup: [...provider.requiredSetup],
    supportedCapabilities: [...provider.supportedCapabilities],
    unsupported: [...provider.unsupported]
  }));
}

export function getSupportedSocialProvider(providerId) {
  return SUPPORTED_SOCIAL_PROVIDERS[providerId] || null;
}

export function createDefaultProviderStatuses({ checkedAt } = {}) {
  return listSupportedSocialProviders().map(provider => createSocialProviderStatus({
    provider: provider.id,
    state: SOCIAL_CONNECTION_STATES.MOCK_SAMPLE,
    source: SOCIAL_DATA_SOURCES.MOCK_SAMPLE,
    checkedAt,
    capabilities: Object.fromEntries(provider.supportedCapabilities.map(capability => [capability, false])),
    requiredPermissions: provider.requiredSetup
  }));
}
