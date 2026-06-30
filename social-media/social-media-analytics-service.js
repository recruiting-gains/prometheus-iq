import {
  SOCIAL_DATA_SOURCES,
  SOCIAL_PROVIDER_IDS,
  createAttributionEvent,
  createCampaignDescriptor,
  createMarketingAnalyticsSnapshot,
  createSocialMetric
} from "./contracts/social-media-contract.js";
import { createDefaultProviderStatuses } from "./providers/social-provider-registry.js";

function sumMetric(metrics, name) {
  return metrics
    .filter(metric => metric.name === name)
    .reduce((total, metric) => total + Number(metric.value || 0), 0);
}

function eventsForTarget(events, target) {
  return events.filter(event => event.target === target);
}

export function createSocialMediaMarketingAnalytics({
  id = "social-media-marketing-analytics-v1",
  generatedAt = new Date().toISOString(),
  window = {},
  providers = createDefaultProviderStatuses({ checkedAt: generatedAt }),
  campaigns = [],
  metrics = [],
  attributionEvents = [],
  notes = []
} = {}) {
  const normalizedCampaigns = campaigns.map(createCampaignDescriptor);
  const normalizedMetrics = metrics.map(createSocialMetric);
  const normalizedEvents = attributionEvents.map(createAttributionEvent);

  const summary = {
    providerCount: providers.length,
    campaignCount: normalizedCampaigns.length,
    metricCount: normalizedMetrics.length,
    attributionEventCount: normalizedEvents.length,
    websiteVisitsAttributed: eventsForTarget(normalizedEvents, "website_traffic").length,
    crmLeadsAttributed: eventsForTarget(normalizedEvents, "crm_lead").length,
    betaEventsAttributed: eventsForTarget(normalizedEvents, "beta_signup").length,
    founderMarketingEvents: eventsForTarget(normalizedEvents, "founder_analytics").length,
    campaignConversions: eventsForTarget(normalizedEvents, "campaign_performance").length,
    totalReach: sumMetric(normalizedMetrics, "reach"),
    totalProfileViews: sumMetric(normalizedMetrics, "profile_views"),
    totalWebsiteClicks: sumMetric(normalizedMetrics, "website_clicks")
  };

  return {
    ...createMarketingAnalyticsSnapshot({
      id,
      generatedAt,
      window,
      providers,
      campaigns: normalizedCampaigns,
      metrics: normalizedMetrics,
      attributionEvents: normalizedEvents,
      notes
    }),
    summary
  };
}

export function createMockFounderMarketingAnalytics({ generatedAt = "2026-06-30T12:00:00.000Z" } = {}) {
  return createSocialMediaMarketingAnalytics({
    id: "social-media-founder-marketing-sample-v1",
    generatedAt,
    window: {
      startsAt: "2026-06-01T00:00:00.000Z",
      endsAt: "2026-06-30T23:59:59.000Z",
      timezone: "America/Chicago"
    },
    campaigns: [
      {
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
      },
      {
        id: "beta-route-iq-awareness-v1",
        name: "Route IQ Beta Awareness",
        platform: "multi_platform",
        objective: "beta_attribution",
        startsAt: "2026-06-01T00:00:00.000Z",
        utm: {
          source: "social",
          medium: "organic",
          campaign: "beta-route-iq-awareness-v1"
        }
      }
    ],
    metrics: [
      {
        name: "reach",
        value: 0,
        source: SOCIAL_DATA_SOURCES.MOCK_SAMPLE,
        provider: SOCIAL_PROVIDER_IDS.INSTAGRAM,
        campaignId: "founder-build-in-public-v1",
        observedAt: generatedAt
      },
      {
        name: "profile_views",
        value: 0,
        source: SOCIAL_DATA_SOURCES.MOCK_SAMPLE,
        provider: SOCIAL_PROVIDER_IDS.INSTAGRAM,
        campaignId: "founder-build-in-public-v1",
        observedAt: generatedAt
      },
      {
        name: "website_clicks",
        value: 0,
        source: SOCIAL_DATA_SOURCES.MOCK_SAMPLE,
        provider: SOCIAL_PROVIDER_IDS.INSTAGRAM,
        campaignId: "beta-route-iq-awareness-v1",
        observedAt: generatedAt
      }
    ],
    attributionEvents: [
      {
        id: "sample-website-contract-event-1",
        type: "website_visit",
        target: "website_traffic",
        source: SOCIAL_DATA_SOURCES.MOCK_SAMPLE,
        provider: SOCIAL_PROVIDER_IDS.INSTAGRAM,
        campaignId: "beta-route-iq-awareness-v1",
        occurredAt: generatedAt,
        confidence: 0,
        metadata: {
          expectedConsumer: "Prometheus Website",
          requiredFields: ["utm_source", "utm_medium", "utm_campaign", "landing_path", "occurred_at"],
          sample: true
        }
      },
      {
        id: "sample-crm-contract-event-1",
        type: "crm_lead_created",
        target: "crm_lead",
        source: SOCIAL_DATA_SOURCES.MOCK_SAMPLE,
        campaignId: "beta-route-iq-awareness-v1",
        occurredAt: generatedAt,
        confidence: 0,
        metadata: {
          expectedConsumer: "Prometheus CRM",
          requiredFields: ["lead_id", "source", "campaign_id", "created_at"],
          sample: true
        }
      },
      {
        id: "sample-beta-contract-event-1",
        type: "beta_signup",
        target: "beta_signup",
        source: SOCIAL_DATA_SOURCES.MOCK_SAMPLE,
        campaignId: "beta-route-iq-awareness-v1",
        occurredAt: generatedAt,
        confidence: 0,
        metadata: {
          expectedConsumer: "Prometheus Dashboard or CRM when beta intake exists",
          requiredFields: ["beta_participant_id", "campaign_id", "signup_at"],
          sample: true
        }
      }
    ],
    notes: [
      "All sample counts are zero by design until supported provider APIs and downstream attribution contracts are connected.",
      "This subsystem owns marketing analytics normalization; Website, CRM, beta, and Founder analytics should consume contracts instead of rebuilding attribution logic."
    ]
  });
}
