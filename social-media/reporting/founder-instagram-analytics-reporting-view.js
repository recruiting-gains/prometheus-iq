import {
  SOCIAL_ATTRIBUTION_TARGETS,
  SOCIAL_DATA_SOURCES,
  SOCIAL_MEDIA_CONTRACT_VERSION,
  SOCIAL_PROVIDER_IDS
} from "../contracts/social-media-contract.js";

export const FOUNDER_INSTAGRAM_ANALYTICS_REPORT_VERSION = "founder-instagram-analytics-reporting-view.v1";

const SOURCE_LABELS = Object.freeze({
  SOCIAL_MEDIA: "Prometheus Social Media",
  WEBSITE: "Prometheus Website",
  CRM: "Prometheus CRM"
});

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function nowIso() {
  return new Date().toISOString();
}

function numberOrZero(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(numberOrZero(value) * factor) / factor;
}

function isInstagramProvider(value) {
  return value === SOCIAL_PROVIDER_IDS.INSTAGRAM || String(value || "").toLowerCase() === "instagram";
}

function isInstagramMetric(metric) {
  return isInstagramProvider(metric?.provider);
}

function isAccountMetric(metric) {
  return isInstagramMetric(metric) && metric?.metadata?.scope !== "content";
}

function observedAt(record) {
  return record?.observedAt || record?.occurredAt || record?.publishedAt || "";
}

function latestMetric(metrics, name) {
  const metric = asArray(metrics)
    .filter(item => item?.name === name && isAccountMetric(item))
    .sort((a, b) => String(observedAt(b)).localeCompare(String(observedAt(a))))[0];
  return metric ? numberOrZero(metric.value) : 0;
}

function firstAndLatestMetricDelta(metrics, name) {
  const sorted = asArray(metrics)
    .filter(item => item?.name === name && isAccountMetric(item))
    .sort((a, b) => String(observedAt(a)).localeCompare(String(observedAt(b))));

  if (sorted.length < 2) return latestMetric(metrics, "follower_growth") || latestMetric(metrics, "followers_growth");
  return numberOrZero(sorted.at(-1).value) - numberOrZero(sorted[0].value);
}

function contentGroups(metrics) {
  const groups = new Map();

  for (const metric of asArray(metrics).filter(item => isInstagramMetric(item) && item?.metadata?.scope === "content")) {
    const mediaId = metric.metadata?.mediaId;
    if (!mediaId) continue;
    const group = groups.get(mediaId) || {
      id: mediaId,
      mediaId,
      mediaType: metric.metadata?.mediaType || "UNKNOWN",
      permalink: metric.metadata?.permalink || null,
      publishedAt: metric.metadata?.publishedAt || null,
      captionPreview: metric.metadata?.captionPreview || "",
      source: SOURCE_LABELS.SOCIAL_MEDIA,
      metrics: {
        reach: 0,
        views: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        saved: 0,
        totalInteractions: 0,
        websiteClicks: 0
      }
    };

    const key = metric.name.replace(/^content_/, "");
    if (key === "total_interactions") group.metrics.totalInteractions = numberOrZero(metric.value);
    else if (key === "website_clicks") group.metrics.websiteClicks = numberOrZero(metric.value);
    else if (key in group.metrics) group.metrics[key] = numberOrZero(metric.value);
    groups.set(mediaId, group);
  }

  return [...groups.values()].map(group => {
    const engagement = group.metrics.totalInteractions ||
      group.metrics.likes +
      group.metrics.comments +
      group.metrics.shares +
      group.metrics.saved;
    const reach = group.metrics.reach || group.metrics.views;
    return {
      ...group,
      metrics: {
        ...group.metrics,
        engagement,
        engagementRate: reach ? round((engagement / reach) * 100) : 0
      }
    };
  });
}

function contentKind(group) {
  const mediaType = String(group?.mediaType || "").toUpperCase();
  if (mediaType.includes("REEL") || mediaType.includes("VIDEO")) return "reel";
  if (mediaType.includes("CAROUSEL")) return "carousel";
  return "post";
}

function topBy(groups, selector, limit = 3, kind = null) {
  return asArray(groups)
    .filter(group => !kind || contentKind(group) === kind)
    .map(group => ({ ...group, score: selector(group) }))
    .filter(group => group.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function instagramWebsiteEvent(event) {
  return event?.target === SOCIAL_ATTRIBUTION_TARGETS.WEBSITE_TRAFFIC &&
    (
      isInstagramProvider(event.provider) ||
      isInstagramProvider(event.metadata?.utm_source) ||
      isInstagramProvider(event.metadata?.campaign_platform)
    );
}

function instagramCrmEvent(event) {
  return event?.target === SOCIAL_ATTRIBUTION_TARGETS.CRM_LEAD &&
    (
      isInstagramProvider(event.provider) ||
      isInstagramProvider(event.metadata?.lead_source) ||
      isInstagramProvider(event.metadata?.campaign_platform) ||
      isInstagramProvider(event.metadata?.utm_source)
    );
}

function campaignKey(event) {
  return event?.campaignId ||
    event?.metadata?.utm_campaign ||
    event?.metadata?.campaign_id ||
    event?.metadata?.campaignId ||
    "uncategorized";
}

function groupCampaigns(events, source) {
  const campaigns = new Map();
  for (const event of asArray(events)) {
    const id = campaignKey(event);
    const current = campaigns.get(id) || {
      campaignId: id,
      count: 0,
      source
    };
    current.count += 1;
    campaigns.set(id, current);
  }
  return [...campaigns.values()].sort((a, b) => b.count - a.count || a.campaignId.localeCompare(b.campaignId));
}

function periodKey(value, granularity) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "undated";
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  if (granularity === "monthly") return `${year}-${month}`;
  if (granularity === "weekly") {
    const weekStart = new Date(Date.UTC(year, date.getUTCMonth(), date.getUTCDate()));
    const weekday = weekStart.getUTCDay() || 7;
    weekStart.setUTCDate(weekStart.getUTCDate() - weekday + 1);
    return weekStart.toISOString().slice(0, 10);
  }
  return `${year}-${month}-${day}`;
}

function addTrendMetric(row, metric) {
  if (metric.name === "reach") row.reach += numberOrZero(metric.value);
  if (metric.name === "impressions") row.impressions += numberOrZero(metric.value);
  if (metric.name === "profile_views") row.profileVisits += numberOrZero(metric.value);
  if (metric.name === "website_clicks") row.websiteClicks += numberOrZero(metric.value);
  if (metric.name === "content_reach") row.contentReach += numberOrZero(metric.value);
  if (metric.name === "content_total_interactions") row.engagement += numberOrZero(metric.value);
  if (["content_likes", "content_comments", "content_shares", "content_saved"].includes(metric.name)) {
    row.engagement += numberOrZero(metric.value);
  }
}

function trendRows({ metrics, websiteEvents, crmEvents, granularity }) {
  const rows = new Map();
  const ensure = period => {
    const current = rows.get(period) || {
      period,
      source: `${SOURCE_LABELS.SOCIAL_MEDIA}; ${SOURCE_LABELS.WEBSITE}; ${SOURCE_LABELS.CRM}`,
      reach: 0,
      impressions: 0,
      profileVisits: 0,
      websiteClicks: 0,
      contentReach: 0,
      engagement: 0,
      websiteVisits: 0,
      crmLeads: 0
    };
    rows.set(period, current);
    return current;
  };

  for (const metric of asArray(metrics).filter(isInstagramMetric)) {
    addTrendMetric(ensure(periodKey(metric.observedAt, granularity)), metric);
  }
  for (const event of asArray(websiteEvents)) {
    ensure(periodKey(event.occurredAt, granularity)).websiteVisits += 1;
  }
  for (const event of asArray(crmEvents)) {
    ensure(periodKey(event.occurredAt, granularity)).crmLeads += 1;
  }

  return [...rows.values()].sort((a, b) => a.period.localeCompare(b.period));
}

function hourFromDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.getUTCHours();
}

function bestPostingTime(topContent) {
  const hour = hourFromDate(topContent?.publishedAt);
  if (hour === null) {
    return {
      title: "Best posting time",
      recommendation: "Keep posting during the current founder workflow until more timestamped content-level data is available.",
      source: SOURCE_LABELS.SOCIAL_MEDIA,
      evidence: "No timestamped top content available."
    };
  }

  return {
    title: "Best posting time",
    recommendation: `Prioritize posts near ${String(hour).padStart(2, "0")}:00 UTC, then validate against future normalized performance.`,
    source: SOURCE_LABELS.SOCIAL_MEDIA,
    evidence: `Top content was published at ${topContent.publishedAt}.`
  };
}

function topicWords(groups) {
  const stop = new Set(["the", "and", "for", "with", "that", "this", "from", "into", "needs", "before"]);
  const counts = new Map();
  for (const group of asArray(groups)) {
    for (const word of String(group.captionPreview || "").toLowerCase().match(/[a-z][a-z-]{3,}/g) || []) {
      if (stop.has(word)) continue;
      counts.set(word, (counts.get(word) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([word]) => word);
}

function recommendations({ groups, websiteEvents, crmEvents }) {
  const topEngagement = topBy(groups, group => group.metrics.engagement, 1)[0];
  const topReach = topBy(groups, group => group.metrics.reach || group.metrics.views, 1)[0];
  const topics = topicWords(groups);
  const topKind = contentKind(topEngagement || topReach || {});
  const websiteVisits = websiteEvents.length;
  const crmLeads = crmEvents.length;

  return [
    bestPostingTime(topEngagement || topReach),
    {
      title: "Recommended content topics",
      recommendation: topics.length
        ? `Repeat and expand these proven topic signals: ${topics.join(", ")}.`
        : "Use founder-led outside-sales intelligence topics until more content captions are available.",
      source: SOURCE_LABELS.SOCIAL_MEDIA,
      evidence: "Derived from normalized content caption previews."
    },
    {
      title: "High-performing content patterns",
      recommendation: `Prioritize ${topKind || "field-lesson"} content that connects field reality to outside-sales intelligence.`,
      source: SOURCE_LABELS.SOCIAL_MEDIA,
      evidence: topEngagement ? `Highest engagement content: ${topEngagement.mediaId}.` : "No content engagement leader available."
    },
    {
      title: "Suggested next post",
      recommendation: "Publish a founder lesson that explains why outside sales needs intelligence before activity, with one concrete field-reality example.",
      source: SOURCE_LABELS.SOCIAL_MEDIA,
      evidence: "Aligned to company identity and existing founder marketing operating system."
    },
    {
      title: "Engagement opportunities",
      recommendation: crmLeads
        ? "Review Instagram-attributed CRM leads and turn recurring objections into the next founder post."
        : websiteVisits
          ? "Review Instagram-attributed website visits and convert the strongest campaign into a clearer CTA."
          : "Use comments, saves, shares, and replies as the next manual engagement review queue.",
      source: `${SOURCE_LABELS.SOCIAL_MEDIA}; ${SOURCE_LABELS.WEBSITE}; ${SOURCE_LABELS.CRM}`,
      evidence: `${websiteVisits} Instagram website visit(s), ${crmLeads} Instagram CRM lead(s).`
    }
  ];
}

export function createFounderInstagramAnalyticsReportingView({
  instagramSnapshot = {},
  websiteAttributionEvents = [],
  crmAttributionEvents = [],
  generatedAt = nowIso()
} = {}) {
  const providers = asArray(instagramSnapshot.providers);
  const provider = providers.find(item => item.provider === SOCIAL_PROVIDER_IDS.INSTAGRAM) || null;
  const metrics = asArray(instagramSnapshot.metrics);
  const websiteEvents = asArray(websiteAttributionEvents).filter(instagramWebsiteEvent);
  const crmEvents = asArray(crmAttributionEvents).filter(instagramCrmEvent);
  const groups = contentGroups(metrics);
  const reach = latestMetric(metrics, "reach");
  const impressions = latestMetric(metrics, "impressions");
  const profileVisits = latestMetric(metrics, "profile_views");
  const websiteClicks = latestMetric(metrics, "website_clicks");
  const followers = latestMetric(metrics, "followers_count");
  const followerGrowth = firstAndLatestMetricDelta(metrics, "followers_count");
  const engagementTotal = groups.reduce((total, group) => total + numberOrZero(group.metrics.engagement), 0);

  return {
    version: FOUNDER_INSTAGRAM_ANALYTICS_REPORT_VERSION,
    generatedAt,
    contractVersion: SOCIAL_MEDIA_CONTRACT_VERSION,
    account: {
      handle: provider?.accountHandle || "@prometheus.iq",
      providerState: provider?.state || "unavailable",
      source: SOURCE_LABELS.SOCIAL_MEDIA
    },
    accountOverview: {
      source: SOURCE_LABELS.SOCIAL_MEDIA,
      followers,
      followerGrowth,
      reach,
      impressions,
      profileVisits,
      websiteClicks,
      engagementRate: reach ? round((engagementTotal / reach) * 100) : 0
    },
    contentPerformance: {
      source: SOURCE_LABELS.SOCIAL_MEDIA,
      topPerformingPosts: topBy(groups, group => group.metrics.engagement, 3, "post"),
      topPerformingReels: topBy(groups, group => group.metrics.engagement, 3, "reel"),
      topPerformingCarousels: topBy(groups, group => group.metrics.engagement, 3, "carousel"),
      highestEngagement: topBy(groups, group => group.metrics.engagement, 1)[0] || null,
      highestWebsiteTraffic: topBy(groups, group => group.metrics.websiteClicks, 1)[0] || null,
      highestReach: topBy(groups, group => group.metrics.reach || group.metrics.views, 1)[0] || null
    },
    growthTrends: {
      source: `${SOURCE_LABELS.SOCIAL_MEDIA}; ${SOURCE_LABELS.WEBSITE}; ${SOURCE_LABELS.CRM}`,
      daily: trendRows({ metrics, websiteEvents, crmEvents, granularity: "daily" }),
      weekly: trendRows({ metrics, websiteEvents, crmEvents, granularity: "weekly" }),
      monthly: trendRows({ metrics, websiteEvents, crmEvents, granularity: "monthly" })
    },
    websiteAttribution: {
      source: SOURCE_LABELS.WEBSITE,
      websiteVisitsFromInstagram: websiteEvents.length,
      utmCampaignSummary: groupCampaigns(websiteEvents, SOURCE_LABELS.WEBSITE),
      trafficTrends: trendRows({ metrics: [], websiteEvents, crmEvents: [], granularity: "daily" })
    },
    crmAttribution: {
      source: SOURCE_LABELS.CRM,
      leadsGeneratedFromInstagram: crmEvents.length,
      campaignAttribution: groupCampaigns(crmEvents, SOURCE_LABELS.CRM),
      conversionSummary: {
        source: SOURCE_LABELS.CRM,
        websiteVisits: websiteEvents.length,
        crmLeads: crmEvents.length,
        visitToLeadRate: websiteEvents.length ? round((crmEvents.length / websiteEvents.length) * 100) : 0
      }
    },
    founderRecommendations: recommendations({ groups, websiteEvents, crmEvents }),
    sourceAudit: [
      {
        label: "Account Overview",
        source: SOURCE_LABELS.SOCIAL_MEDIA,
        input: "normalized Instagram analytics snapshot"
      },
      {
        label: "Content Performance",
        source: SOURCE_LABELS.SOCIAL_MEDIA,
        input: "normalized Instagram content metrics"
      },
      {
        label: "Website Attribution",
        source: SOURCE_LABELS.WEBSITE,
        input: "website attribution events"
      },
      {
        label: "CRM Attribution",
        source: SOURCE_LABELS.CRM,
        input: "CRM attribution events"
      }
    ],
    safety: {
      presentationOnly: true,
      directInstagramApiCalls: false,
      metaCredentialAccess: false,
      ingestionLogicDuplicated: false,
      modifiesInfrastructure: false,
      modifiesCompanion: false,
      modifiesWebsiteAttribution: false,
      modifiesCrmAttribution: false
    }
  };
}

export function createEmptyFounderInstagramAnalyticsReportingView({ generatedAt = nowIso() } = {}) {
  return createFounderInstagramAnalyticsReportingView({
    instagramSnapshot: {
      contractVersion: SOCIAL_MEDIA_CONTRACT_VERSION,
      providers: [{
        provider: SOCIAL_PROVIDER_IDS.INSTAGRAM,
        state: "unavailable",
        source: SOCIAL_DATA_SOURCES.MOCK_SAMPLE,
        checkedAt: generatedAt
      }],
      metrics: []
    },
    generatedAt
  });
}
