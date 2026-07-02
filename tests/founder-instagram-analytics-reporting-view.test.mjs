import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  FOUNDER_INSTAGRAM_ANALYTICS_REPORT_VERSION,
  createEmptyFounderInstagramAnalyticsReportingView,
  createFounderInstagramAnalyticsReportingView
} from "../social-media/reporting/founder-instagram-analytics-reporting-view.js";
import {
  SOCIAL_ATTRIBUTION_EVENT_TYPES,
  SOCIAL_ATTRIBUTION_TARGETS,
  SOCIAL_DATA_SOURCES,
  SOCIAL_MEDIA_CONTRACT_VERSION,
  SOCIAL_PROVIDER_IDS
} from "../social-media/contracts/social-media-contract.js";

const generatedAt = "2026-07-02T12:00:00.000Z";

const instagramSnapshot = {
  contractVersion: SOCIAL_MEDIA_CONTRACT_VERSION,
  generatedAt,
  providers: [{
    provider: SOCIAL_PROVIDER_IDS.INSTAGRAM,
    state: "connected",
    source: SOCIAL_DATA_SOURCES.PROVIDER_API,
    accountHandle: "@prometheus.iq",
    checkedAt: generatedAt
  }],
  metrics: [
    { name: "followers_count", value: 100, provider: "instagram", source: "provider_api", observedAt: "2026-07-01T12:00:00.000Z", metadata: { scope: "account" } },
    { name: "followers_count", value: 118, provider: "instagram", source: "provider_api", observedAt: generatedAt, metadata: { scope: "account" } },
    { name: "reach", value: 1000, provider: "instagram", source: "provider_api", observedAt: generatedAt, metadata: { scope: "account" } },
    { name: "impressions", value: 1600, provider: "instagram", source: "provider_api", observedAt: generatedAt, metadata: { scope: "account" } },
    { name: "profile_views", value: 90, provider: "instagram", source: "provider_api", observedAt: generatedAt, metadata: { scope: "account" } },
    { name: "website_clicks", value: 20, provider: "instagram", source: "provider_api", observedAt: generatedAt, metadata: { scope: "account" } },
    { name: "content_reach", value: 500, provider: "instagram", source: "provider_api", observedAt: generatedAt, metadata: { scope: "content", mediaId: "post_1", mediaType: "IMAGE", permalink: "https://instagram.com/p/post1", publishedAt: "2026-07-02T14:00:00.000Z", captionPreview: "Field reality beats dashboard theory for outside sales." } },
    { name: "content_likes", value: 30, provider: "instagram", source: "provider_api", observedAt: generatedAt, metadata: { scope: "content", mediaId: "post_1", mediaType: "IMAGE", permalink: "https://instagram.com/p/post1", publishedAt: "2026-07-02T14:00:00.000Z", captionPreview: "Field reality beats dashboard theory for outside sales." } },
    { name: "content_comments", value: 7, provider: "instagram", source: "provider_api", observedAt: generatedAt, metadata: { scope: "content", mediaId: "post_1", mediaType: "IMAGE", permalink: "https://instagram.com/p/post1", publishedAt: "2026-07-02T14:00:00.000Z", captionPreview: "Field reality beats dashboard theory for outside sales." } },
    { name: "content_total_interactions", value: 44, provider: "instagram", source: "provider_api", observedAt: generatedAt, metadata: { scope: "content", mediaId: "post_1", mediaType: "IMAGE", permalink: "https://instagram.com/p/post1", publishedAt: "2026-07-02T14:00:00.000Z", captionPreview: "Field reality beats dashboard theory for outside sales." } },
    { name: "content_reach", value: 800, provider: "instagram", source: "provider_api", observedAt: generatedAt, metadata: { scope: "content", mediaId: "reel_1", mediaType: "REEL", permalink: "https://instagram.com/reel/reel1", publishedAt: "2026-07-02T16:00:00.000Z", captionPreview: "Outside sales needs intelligence before activity." } },
    { name: "content_views", value: 1200, provider: "instagram", source: "provider_api", observedAt: generatedAt, metadata: { scope: "content", mediaId: "reel_1", mediaType: "REEL", permalink: "https://instagram.com/reel/reel1", publishedAt: "2026-07-02T16:00:00.000Z", captionPreview: "Outside sales needs intelligence before activity." } },
    { name: "content_likes", value: 80, provider: "instagram", source: "provider_api", observedAt: generatedAt, metadata: { scope: "content", mediaId: "reel_1", mediaType: "REEL", permalink: "https://instagram.com/reel/reel1", publishedAt: "2026-07-02T16:00:00.000Z", captionPreview: "Outside sales needs intelligence before activity." } },
    { name: "content_comments", value: 10, provider: "instagram", source: "provider_api", observedAt: generatedAt, metadata: { scope: "content", mediaId: "reel_1", mediaType: "REEL", permalink: "https://instagram.com/reel/reel1", publishedAt: "2026-07-02T16:00:00.000Z", captionPreview: "Outside sales needs intelligence before activity." } },
    { name: "content_shares", value: 12, provider: "instagram", source: "provider_api", observedAt: generatedAt, metadata: { scope: "content", mediaId: "reel_1", mediaType: "REEL", permalink: "https://instagram.com/reel/reel1", publishedAt: "2026-07-02T16:00:00.000Z", captionPreview: "Outside sales needs intelligence before activity." } },
    { name: "content_total_interactions", value: 105, provider: "instagram", source: "provider_api", observedAt: generatedAt, metadata: { scope: "content", mediaId: "reel_1", mediaType: "REEL", permalink: "https://instagram.com/reel/reel1", publishedAt: "2026-07-02T16:00:00.000Z", captionPreview: "Outside sales needs intelligence before activity." } },
    { name: "content_reach", value: 650, provider: "instagram", source: "provider_api", observedAt: generatedAt, metadata: { scope: "content", mediaId: "carousel_1", mediaType: "CAROUSEL_ALBUM", permalink: "https://instagram.com/p/carousel1", publishedAt: "2026-07-01T18:00:00.000Z", captionPreview: "Why field sales needs a compounding learning loop." } },
    { name: "content_saved", value: 25, provider: "instagram", source: "provider_api", observedAt: generatedAt, metadata: { scope: "content", mediaId: "carousel_1", mediaType: "CAROUSEL_ALBUM", permalink: "https://instagram.com/p/carousel1", publishedAt: "2026-07-01T18:00:00.000Z", captionPreview: "Why field sales needs a compounding learning loop." } },
    { name: "content_total_interactions", value: 70, provider: "instagram", source: "provider_api", observedAt: generatedAt, metadata: { scope: "content", mediaId: "carousel_1", mediaType: "CAROUSEL_ALBUM", permalink: "https://instagram.com/p/carousel1", publishedAt: "2026-07-01T18:00:00.000Z", captionPreview: "Why field sales needs a compounding learning loop." } },
    { name: "content_website_clicks", value: 9, provider: "instagram", source: "provider_api", observedAt: generatedAt, metadata: { scope: "content", mediaId: "carousel_1", mediaType: "CAROUSEL_ALBUM", permalink: "https://instagram.com/p/carousel1", publishedAt: "2026-07-01T18:00:00.000Z", captionPreview: "Why field sales needs a compounding learning loop." } }
  ]
};

const websiteAttributionEvents = [
  {
    id: "web_1",
    type: SOCIAL_ATTRIBUTION_EVENT_TYPES.WEBSITE_VISIT,
    target: SOCIAL_ATTRIBUTION_TARGETS.WEBSITE_TRAFFIC,
    source: SOCIAL_DATA_SOURCES.WEBSITE_CONTRACT,
    provider: "instagram",
    campaignId: "founder-build-in-public-v1",
    occurredAt: "2026-07-02T17:00:00.000Z",
    metadata: {
      utm_source: "instagram",
      utm_campaign: "founder-build-in-public-v1",
      utm_content: "reel_1"
    }
  },
  {
    id: "web_2",
    type: SOCIAL_ATTRIBUTION_EVENT_TYPES.WEBSITE_VISIT,
    target: SOCIAL_ATTRIBUTION_TARGETS.WEBSITE_TRAFFIC,
    source: SOCIAL_DATA_SOURCES.WEBSITE_CONTRACT,
    provider: "instagram",
    campaignId: "founder-build-in-public-v1",
    occurredAt: "2026-07-02T18:00:00.000Z",
    metadata: {
      utm_source: "instagram",
      utm_campaign: "founder-build-in-public-v1"
    }
  }
];

const crmAttributionEvents = [
  {
    id: "crm_1",
    type: SOCIAL_ATTRIBUTION_EVENT_TYPES.CRM_LEAD_CREATED,
    target: SOCIAL_ATTRIBUTION_TARGETS.CRM_LEAD,
    source: SOCIAL_DATA_SOURCES.CRM_CONTRACT,
    provider: "instagram",
    campaignId: "founder-build-in-public-v1",
    occurredAt: "2026-07-02T19:00:00.000Z",
    metadata: {
      lead_source: "instagram",
      campaign_platform: "instagram"
    }
  }
];

test("Founder Instagram Analytics Reporting View creates executive sections with explicit sources", () => {
  const view = createFounderInstagramAnalyticsReportingView({
    instagramSnapshot,
    websiteAttributionEvents,
    crmAttributionEvents,
    generatedAt
  });

  assert.equal(view.version, FOUNDER_INSTAGRAM_ANALYTICS_REPORT_VERSION);
  assert.equal(view.account.source, "Prometheus Social Media");
  assert.equal(view.accountOverview.source, "Prometheus Social Media");
  assert.equal(view.websiteAttribution.source, "Prometheus Website");
  assert.equal(view.crmAttribution.source, "Prometheus CRM");
  assert.equal(view.accountOverview.followers, 118);
  assert.equal(view.accountOverview.followerGrowth, 18);
  assert.equal(view.accountOverview.reach, 1000);
  assert.equal(view.accountOverview.impressions, 1600);
  assert.equal(view.accountOverview.profileVisits, 90);
  assert.equal(view.accountOverview.websiteClicks, 20);
  assert.equal(view.accountOverview.engagementRate, 21.9);
});

test("Founder Instagram Analytics Reporting View ranks content by type and metric", () => {
  const view = createFounderInstagramAnalyticsReportingView({
    instagramSnapshot,
    websiteAttributionEvents,
    crmAttributionEvents,
    generatedAt
  });

  assert.equal(view.contentPerformance.topPerformingPosts[0].mediaId, "post_1");
  assert.equal(view.contentPerformance.topPerformingReels[0].mediaId, "reel_1");
  assert.equal(view.contentPerformance.topPerformingCarousels[0].mediaId, "carousel_1");
  assert.equal(view.contentPerformance.highestEngagement.mediaId, "reel_1");
  assert.equal(view.contentPerformance.highestWebsiteTraffic.mediaId, "carousel_1");
  assert.equal(view.contentPerformance.highestReach.mediaId, "reel_1");
});

test("Founder Instagram Analytics Reporting View summarizes Website and CRM attribution without owning them", () => {
  const view = createFounderInstagramAnalyticsReportingView({
    instagramSnapshot,
    websiteAttributionEvents,
    crmAttributionEvents,
    generatedAt
  });

  assert.equal(view.websiteAttribution.websiteVisitsFromInstagram, 2);
  assert.equal(view.websiteAttribution.utmCampaignSummary[0].campaignId, "founder-build-in-public-v1");
  assert.equal(view.websiteAttribution.utmCampaignSummary[0].count, 2);
  assert.equal(view.crmAttribution.leadsGeneratedFromInstagram, 1);
  assert.equal(view.crmAttribution.campaignAttribution[0].campaignId, "founder-build-in-public-v1");
  assert.equal(view.crmAttribution.conversionSummary.visitToLeadRate, 50);
});

test("Founder Instagram Analytics Reporting View produces daily, weekly, and monthly trends", () => {
  const view = createFounderInstagramAnalyticsReportingView({
    instagramSnapshot,
    websiteAttributionEvents,
    crmAttributionEvents,
    generatedAt
  });

  assert.ok(view.growthTrends.daily.some(row => row.period === "2026-07-02" && row.websiteVisits === 2 && row.crmLeads === 1));
  assert.ok(view.growthTrends.weekly.some(row => row.period === "2026-06-29"));
  assert.ok(view.growthTrends.monthly.some(row => row.period === "2026-07"));
});

test("Founder Instagram Analytics Reporting View generates read-only founder recommendations", () => {
  const view = createFounderInstagramAnalyticsReportingView({
    instagramSnapshot,
    websiteAttributionEvents,
    crmAttributionEvents,
    generatedAt
  });

  assert.equal(view.founderRecommendations.length, 5);
  assert.ok(view.founderRecommendations.some(item => item.title === "Best posting time"));
  assert.ok(view.founderRecommendations.some(item => item.title === "Suggested next post"));
  assert.equal(view.safety.presentationOnly, true);
  assert.equal(view.safety.directInstagramApiCalls, false);
  assert.equal(view.safety.metaCredentialAccess, false);
  assert.equal(view.safety.modifiesInfrastructure, false);
  assert.equal(view.safety.modifiesCompanion, false);
  assert.equal(view.safety.modifiesWebsiteAttribution, false);
  assert.equal(view.safety.modifiesCrmAttribution, false);
});

test("Founder Instagram Analytics Reporting View does not call APIs or reference credentials", () => {
  const source = readFileSync(new URL("../social-media/reporting/founder-instagram-analytics-reporting-view.js", import.meta.url), "utf8");
  const forbidden = [
    "fetch(",
    "INSTAGRAM_ACCESS_TOKEN",
    "META_APP_SECRET",
    "META_INSTAGRAM_ACCESS_TOKEN",
    "completeMetaInstagramOAuthConnection",
    "fetchInstagramBusinessSnapshot"
  ];

  for (const term of forbidden) {
    assert.equal(source.includes(term), false, `reporting view must not contain ${term}`);
  }
});

test("empty Founder Instagram Analytics Reporting View remains presentation-safe", () => {
  const view = createEmptyFounderInstagramAnalyticsReportingView({ generatedAt });

  assert.equal(view.account.handle, "@prometheus.iq");
  assert.equal(view.accountOverview.followers, 0);
  assert.deepEqual(view.contentPerformance.topPerformingPosts, []);
  assert.equal(view.websiteAttribution.websiteVisitsFromInstagram, 0);
  assert.equal(view.crmAttribution.leadsGeneratedFromInstagram, 0);
  assert.equal(view.safety.presentationOnly, true);
});
