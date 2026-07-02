import {
  SOCIAL_CONNECTION_STATES,
  SOCIAL_DATA_SOURCES,
  SOCIAL_MEDIA_CONTRACT_VERSION,
  SOCIAL_PROVIDER_IDS
} from "../social-media/contracts/social-media-contract.js";

const LOCAL_NORMALIZED_INSTAGRAM_SNAPSHOT_URL = "http://127.0.0.1:8792/api/social/instagram/snapshot";

function environmentSnapshotUrl() {
  if (typeof process !== "undefined" && process?.env?.PROMETHEUS_SOCIAL_MEDIA_SNAPSHOT_URL) {
    return process.env.PROMETHEUS_SOCIAL_MEDIA_SNAPSHOT_URL;
  }

  if (typeof window !== "undefined") {
    return LOCAL_NORMALIZED_INSTAGRAM_SNAPSHOT_URL;
  }

  return "";
}

function unwrapSnapshot(payload) {
  return payload?.snapshot || payload?.data?.snapshot || payload;
}

async function fetchJsonWithTimeout(fetchImpl, url, timeoutMs = 3500) {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timeout = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

  try {
    const response = await fetchImpl(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: controller?.signal
    });
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export function getDefaultFounderSocialAnalyticsService({
  fetchImpl = globalThis.fetch,
  snapshotUrl = environmentSnapshotUrl()
} = {}) {
  return {
    sourceSubsystem: "Prometheus Social Media",
    async getInstagramAnalyticsSnapshot() {
      if (!snapshotUrl || typeof fetchImpl !== "function") return null;
      const payload = await fetchJsonWithTimeout(fetchImpl, snapshotUrl);
      return unwrapSnapshot(payload);
    }
  };
}

function isInstagramMetric(metric) {
  return metric?.provider === SOCIAL_PROVIDER_IDS.INSTAGRAM;
}

function isAccountMetric(metric) {
  return isInstagramMetric(metric) && metric?.metadata?.scope !== "content";
}

function latestMetricValue(metrics, name) {
  const metric = metrics
    .filter(item => item?.name === name && isAccountMetric(item))
    .sort((a, b) => String(b.observedAt || "").localeCompare(String(a.observedAt || "")))[0];
  return Number.isFinite(Number(metric?.value)) ? Number(metric.value) : null;
}

function sumMetric(metrics, name) {
  const matching = metrics.filter(item => item?.name === name && isInstagramMetric(item));
  if (!matching.length) return null;
  return matching.reduce((total, metric) => total + Number(metric.value || 0), 0);
}

function formatCount(value) {
  if (value === null || value === undefined) return "unavailable";
  return new Intl.NumberFormat("en-US").format(Number(value || 0));
}

function providerStatus(snapshot) {
  return snapshot?.providers?.find(provider => provider.provider === SOCIAL_PROVIDER_IDS.INSTAGRAM) || null;
}

function contentGroups(metrics) {
  const groups = new Map();

  for (const metric of metrics.filter(item => isInstagramMetric(item) && item?.metadata?.scope === "content")) {
    const mediaId = metric.metadata?.mediaId;
    if (!mediaId) continue;
    const current = groups.get(mediaId) || {
      mediaId,
      mediaType: metric.metadata?.mediaType || "content",
      permalink: metric.metadata?.permalink || null,
      publishedAt: metric.metadata?.publishedAt || null,
      captionPreview: metric.metadata?.captionPreview || "",
      metrics: {}
    };
    current.metrics[metric.name] = Number(metric.value || 0);
    groups.set(mediaId, current);
  }

  return [...groups.values()];
}

function contentScore(group) {
  if (group.metrics.content_total_interactions !== undefined) return Number(group.metrics.content_total_interactions || 0);

  return (
    Number(group.metrics.content_likes || 0) +
    Number(group.metrics.content_comments || 0) +
    Number(group.metrics.content_shares || 0) +
    Number(group.metrics.content_saved || 0)
  ) ||
    Number(group.metrics.content_views || 0) ||
    Number(group.metrics.content_reach || 0);
}

function topContentText(metrics) {
  const top = contentGroups(metrics)
    .map(group => ({ ...group, score: contentScore(group) }))
    .sort((a, b) => b.score - a.score)[0];

  if (!top) return "Top performing content: no content-level metrics are available in the normalized Social Media snapshot.";

  const caption = top.captionPreview ? ` "${top.captionPreview}"` : "";
  const details = [
    `${formatCount(top.score)} engagement score`,
    top.metrics.content_views !== undefined ? `${formatCount(top.metrics.content_views)} views` : "",
    top.metrics.content_reach !== undefined ? `${formatCount(top.metrics.content_reach)} reach` : ""
  ].filter(Boolean).join(", ");

  return `Top performing content: ${String(top.mediaType || "content").toUpperCase()}${caption} with ${details}.`;
}

function normalizedCommand(command = "") {
  return String(command || "")
    .toLowerCase()
    .replace(/[’‘']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isFounderInstagramAnalyticsCommand(command = "") {
  const normalized = normalizedCommand(command);
  if (!normalized) return false;
  if (["instagram", "instagram analytics", "show instagram analytics", "show me my instagram analytics"].includes(normalized)) return true;
  if (normalized.includes("instagram") && (
    normalized.includes("doing") ||
    normalized.includes("analytics") ||
    normalized.includes("reach") ||
    normalized.includes("followers") ||
    normalized.includes("website clicks") ||
    normalized.includes("performed") ||
    normalized.includes("post")
  )) return true;
  return [
    "how many followers",
    "followers do we have",
    "how much reach",
    "reach did we get",
    "which post performed best",
    "best performing post",
    "top performing post",
    "what should i post next",
    "what should we post next",
    "post next"
  ].some(phrase => normalized.includes(phrase));
}

function growthTrendText(snapshot, metrics) {
  const direct = ["followers_growth", "follower_growth", "followers_delta", "growth_rate", "profile_growth", "reach_growth"]
    .map(name => latestMetricValue(metrics, name))
    .find(value => value !== null);

  if (direct !== undefined) return `Growth trend: ${formatCount(direct)} from normalized Social Media trend metrics.`;
  if (snapshot?.summary?.growthTrend) return `Growth trend: ${snapshot.summary.growthTrend}.`;
  return "Growth trend: pending historical comparison from Prometheus Social Media; current snapshot has no trend metric.";
}

function sourceLabel(snapshot, status) {
  if (!snapshot) return "normalized snapshot unavailable";
  if (status?.state === SOCIAL_CONNECTION_STATES.CONNECTED) return "normalized provider_api snapshot";
  if (status?.source === SOCIAL_DATA_SOURCES.MOCK_SAMPLE) return "mock/sample normalized snapshot";
  return "normalized Social Media snapshot";
}

export async function createFounderInstagramAnalyticsBrief({
  snapshot = null,
  service = getDefaultFounderSocialAnalyticsService()
} = {}) {
  const analyticsSnapshot = snapshot || await service.getInstagramAnalyticsSnapshot();
  const status = providerStatus(analyticsSnapshot);
  const metrics = Array.isArray(analyticsSnapshot?.metrics) ? analyticsSnapshot.metrics : [];
  const reach = latestMetricValue(metrics, "reach");
  const impressions = latestMetricValue(metrics, "impressions");
  const profileVisits = latestMetricValue(metrics, "profile_views");
  const websiteClicks = latestMetricValue(metrics, "website_clicks");
  const followers = latestMetricValue(metrics, "followers_count");
  const engagement = sumMetric(metrics, "content_total_interactions") ??
    ["content_likes", "content_comments", "content_shares", "content_saved"].reduce((total, name) => total + Number(sumMetric(metrics, name) || 0), 0);
  const topContent = topContentText(metrics);
  const growthTrend = growthTrendText(analyticsSnapshot, metrics);

  const contractVersion = analyticsSnapshot?.contractVersion || "unavailable";
  const contractOk = contractVersion === SOCIAL_MEDIA_CONTRACT_VERSION;
  const state = status?.state || "unavailable";
  const account = status?.accountHandle || "@prometheus.iq";

  return {
    title: "Instagram Analytics",
    body: [
      `Instagram (Source: Prometheus Social Media): ${account}; state ${state}; ${sourceLabel(analyticsSnapshot, status)}; contract ${contractVersion}${contractOk ? "" : " (unexpected contract version)"}.`,
      `Followers: ${formatCount(followers)}.`,
      `Reach: ${formatCount(reach)}.`,
      `Impressions: ${formatCount(impressions)}.`,
      `Profile visits: ${formatCount(profileVisits)}.`,
      `Website clicks: ${formatCount(websiteClicks)}.`,
      `Engagement: ${formatCount(engagement)}.`,
      topContent,
      growthTrend,
      "Companion role: presentation only; no Instagram API calls, tokens, Meta credentials, or Social Media normalization logic are owned here."
    ].join(" "),
    metadata: {
      sourceSubsystem: "Prometheus Social Media",
      consumedContract: SOCIAL_MEDIA_CONTRACT_VERSION,
      receivedContract: contractVersion,
      provider: SOCIAL_PROVIDER_IDS.INSTAGRAM,
      providerState: state,
      metricSource: status?.source || "unavailable",
      metrics: {
        followers,
        reach,
        impressions,
        profileVisits,
        websiteClicks,
        engagement
      },
      topContentText: topContent,
      growthTrendText: growthTrend,
      presentationOnly: true,
      directInstagramApiCalls: false
    }
  };
}

function directLeadForCommand(command, analytics) {
  const normalized = normalizedCommand(command);
  const metrics = analytics.metadata.metrics || {};

  if (normalized.includes("followers")) {
    return `Direct answer: Followers: ${formatCount(metrics.followers)}. Source: Prometheus Social Media.`;
  }
  if (normalized.includes("reach")) {
    return `Direct answer: Reach: ${formatCount(metrics.reach)}. Source: Prometheus Social Media.`;
  }
  if (normalized.includes("website click")) {
    return `Direct answer: Website clicks from Instagram: ${formatCount(metrics.websiteClicks)}. Source: Prometheus Social Media.`;
  }
  if (normalized.includes("performed best") || normalized.includes("best performing") || normalized.includes("top performing")) {
    return `Direct answer: ${analytics.metadata.topContentText} Source: Prometheus Social Media.`;
  }
  if (normalized.includes("post next")) {
    return [
      `Direct answer: use the strongest normalized Instagram signal. ${analytics.metadata.topContentText}`,
      "Recommendation: post a concise founder lesson about field-sales intelligence, pilot proof, or why outside sales needs direction before activity.",
      "Keep it public-safe: do not show private dashboards, route scoring, customer data, Anthony beta details, or proprietary mechanics.",
      "Source: Prometheus Social Media."
    ].join(" ");
  }

  return [
    `Direct answer: Instagram has ${formatCount(metrics.followers)} followers, ${formatCount(metrics.reach)} reach, ${formatCount(metrics.impressions)} impressions, ${formatCount(metrics.profileVisits)} profile visits, ${formatCount(metrics.websiteClicks)} website clicks, and ${formatCount(metrics.engagement)} engagement.`,
    "Source: Prometheus Social Media."
  ].join(" ");
}

export async function createFounderInstagramDirectAnswer({
  command = "",
  service = getDefaultFounderSocialAnalyticsService()
} = {}) {
  const analytics = await createFounderInstagramAnalyticsBrief({ service });

  return {
    title: "Instagram Analytics",
    body: [
      directLeadForCommand(command, analytics),
      analytics.body
    ].join(" "),
    metadata: {
      ...analytics.metadata,
      intent: "instagram_analytics_direct_query"
    }
  };
}
