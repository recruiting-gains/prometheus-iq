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
      topContentText(metrics),
      growthTrendText(analyticsSnapshot, metrics),
      "Companion role: presentation only; no Instagram API calls, tokens, Meta credentials, or Social Media normalization logic are owned here."
    ].join(" "),
    metadata: {
      sourceSubsystem: "Prometheus Social Media",
      consumedContract: SOCIAL_MEDIA_CONTRACT_VERSION,
      receivedContract: contractVersion,
      provider: SOCIAL_PROVIDER_IDS.INSTAGRAM,
      providerState: state,
      metricSource: status?.source || "unavailable",
      presentationOnly: true,
      directInstagramApiCalls: false
    }
  };
}
