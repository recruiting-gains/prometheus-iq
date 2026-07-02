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
  if (value === null || value === undefined) return "not in the latest read";
  return new Intl.NumberFormat("en-US").format(Number(value || 0));
}

function spokenAccountLabel(account = "@prometheus.iq") {
  const normalized = String(account || "").trim().toLowerCase();
  if (normalized === "@prometheus.iq" || normalized === "prometheus.iq") {
    return "Prometheus I Q on Instagram";
  }
  return `${String(account || "the account").replace(/^@/, "")} on Instagram`;
}

function hasValue(value) {
  return value !== null && value !== undefined;
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

  if (!top) return "I do not have a clear top post yet from today's social read.";

  const caption = top.captionPreview ? ` "${top.captionPreview}"` : "";
  const details = [
    `${formatCount(top.score)} engagement score`,
    top.metrics.content_views !== undefined ? `${formatCount(top.metrics.content_views)} views` : "",
    top.metrics.content_reach !== undefined ? `${formatCount(top.metrics.content_reach)} reach` : ""
  ].filter(Boolean).join(", ");

  return `Best post so far: ${String(top.mediaType || "content").toUpperCase()}${caption} with ${details}.`;
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
  if (isDeveloperModeRequest(normalized) && normalized.includes("instagram")) return true;
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

export function isDeveloperModeRequest(command = "") {
  const normalized = normalizedCommand(command);
  return [
    "show technical details",
    "developer mode",
    "show raw data",
    "raw data",
    "technical details"
  ].some(phrase => normalized.includes(phrase));
}

function growthTrendText(snapshot, metrics) {
  const direct = ["followers_growth", "follower_growth", "followers_delta", "growth_rate", "profile_growth", "reach_growth"]
    .map(name => latestMetricValue(metrics, name))
    .find(value => value !== null);

  if (direct !== undefined) return `Growth is up ${formatCount(direct)} on the latest read.`;
  if (snapshot?.summary?.growthTrend) return `Growth: ${snapshot.summary.growthTrend}.`;
  return "Growth needs one more comparable read before I would call the trend.";
}

function sourceLabel(snapshot, status) {
  if (!snapshot) return "I could not reach today's social read yet";
  if (status?.state === SOCIAL_CONNECTION_STATES.CONNECTED) return "the live social read is connected";
  if (status?.source === SOCIAL_DATA_SOURCES.MOCK_SAMPLE) return "I only have sample social data right now";
  return "the social read is partially available";
}

function missingMetricsText(metrics = {}) {
  const missing = [
    ["followers", metrics.followers],
    ["reach", metrics.reach],
    ["impressions", metrics.impressions],
    ["profile visits", metrics.profileVisits],
    ["website clicks", metrics.websiteClicks],
    ["engagement", metrics.engagement]
  ].filter(([, value]) => !hasValue(value)).map(([label]) => label);

  if (!missing.length) return "";
  if (missing.length === 1) return `I could not retrieve the latest ${missing[0]} number yet.`;
  return `I could not retrieve the latest ${missing.slice(0, -1).join(", ")} or ${missing.at(-1)} numbers yet.`;
}

function founderMetricsText(metrics = {}) {
  const available = [
    hasValue(metrics.followers) ? `${formatCount(metrics.followers)} followers` : "",
    hasValue(metrics.reach) ? `${formatCount(metrics.reach)} reach` : "",
    hasValue(metrics.impressions) ? `${formatCount(metrics.impressions)} impressions` : "",
    hasValue(metrics.profileVisits) ? `${formatCount(metrics.profileVisits)} profile visits` : "",
    hasValue(metrics.websiteClicks) ? `${formatCount(metrics.websiteClicks)} website clicks` : "",
    hasValue(metrics.engagement) ? `${formatCount(metrics.engagement)} engagement` : ""
  ].filter(Boolean);

  if (!available.length) return "I could not retrieve today's Instagram numbers yet.";
  return available.join(", ");
}

function createFounderBody({ account, status, metrics, topContent, growthTrend }) {
  const missing = missingMetricsText(metrics);
  return [
    `Instagram status for ${spokenAccountLabel(account)}: ${founderMetricsText(metrics)}.`,
    topContent,
    growthTrend,
    missing,
    "Recommendation: post one field-proof lesson next, not a broad ROI claim."
  ].filter(Boolean).join(" ");
}

function createDeveloperBody({
  analyticsSnapshot,
  account,
  state,
  status,
  source,
  contractVersion,
  contractOk,
  followers,
  reach,
  impressions,
  profileVisits,
  websiteClicks,
  engagement,
  topContent,
  growthTrend
}) {
  return [
    `Instagram (Source: Prometheus Social Media): ${account}; state ${state}; ${source}; contract ${contractVersion}${contractOk ? "" : " (unexpected contract version)"}.`,
    `Followers: ${formatCount(followers)}.`,
    `Reach: ${formatCount(reach)}.`,
    `Impressions: ${formatCount(impressions)}.`,
    `Profile visits: ${formatCount(profileVisits)}.`,
    `Website clicks: ${formatCount(websiteClicks)}.`,
    `Engagement: ${formatCount(engagement)}.`,
    topContent,
    growthTrend,
    `Raw provider state: ${JSON.stringify(status || {})}.`,
    `Raw snapshot id: ${analyticsSnapshot?.id || "missing"}.`,
    "Companion role: presentation only; no Instagram API calls, tokens, Meta credentials, or Social Media normalization logic are owned here."
  ].join(" ");
}

export async function createFounderInstagramAnalyticsBrief({
  snapshot = null,
  service = getDefaultFounderSocialAnalyticsService(),
  developerMode = false
} = {}) {
  const analyticsSnapshot = snapshot || await service.getInstagramAnalyticsSnapshot();
  const status = providerStatus(analyticsSnapshot);
  const metricRecords = Array.isArray(analyticsSnapshot?.metrics) ? analyticsSnapshot.metrics : [];
  const reach = latestMetricValue(metricRecords, "reach");
  const impressions = latestMetricValue(metricRecords, "impressions");
  const profileVisits = latestMetricValue(metricRecords, "profile_views");
  const websiteClicks = latestMetricValue(metricRecords, "website_clicks");
  const followers = latestMetricValue(metricRecords, "followers_count");
  const engagement = sumMetric(metricRecords, "content_total_interactions") ??
    ["content_likes", "content_comments", "content_shares", "content_saved"].reduce((total, name) => total + Number(sumMetric(metricRecords, name) || 0), 0);
  const topContent = topContentText(metricRecords);
  const growthTrend = growthTrendText(analyticsSnapshot, metricRecords);

  const contractVersion = analyticsSnapshot?.contractVersion || "unavailable";
  const contractOk = contractVersion === SOCIAL_MEDIA_CONTRACT_VERSION;
  const state = status?.state || "unavailable";
  const account = status?.accountHandle || "@prometheus.iq";
  const metrics = {
    followers,
    reach,
    impressions,
    profileVisits,
    websiteClicks,
    engagement
  };
  const source = sourceLabel(analyticsSnapshot, status);
  const founderBody = createFounderBody({
    account,
    status,
    metrics,
    topContent,
    growthTrend
  });
  const developerBody = createDeveloperBody({
    analyticsSnapshot,
    account,
    state,
    status,
    source,
    contractVersion,
    contractOk,
    followers,
    reach,
    impressions,
    profileVisits,
    websiteClicks,
    engagement,
    topContent,
    growthTrend
  });

  return {
    title: "Instagram Analytics",
    body: developerMode ? developerBody : founderBody,
    metadata: {
      sourceSubsystem: "Prometheus Social Media",
      consumedContract: SOCIAL_MEDIA_CONTRACT_VERSION,
      receivedContract: contractVersion,
      provider: SOCIAL_PROVIDER_IDS.INSTAGRAM,
      providerState: state,
      metricSource: status?.source || "unavailable",
      metrics,
      topContentText: topContent,
      growthTrendText: growthTrend,
      founderMode: !developerMode,
      developerMode,
      developerBody,
      presentationOnly: true,
      directInstagramApiCalls: false
    }
  };
}

function directLeadForCommand(command, analytics, { developerMode = false } = {}) {
  const normalized = normalizedCommand(command);
  const metrics = analytics.metadata.metrics || {};
  if (developerMode) return "Developer mode requested. Here are the technical details behind the Instagram answer.";

  if (normalized.includes("followers")) {
    return hasValue(metrics.followers)
      ? `We have ${formatCount(metrics.followers)} Instagram followers right now.`
      : "I could not retrieve the latest follower count yet, but I can still review the rest of today's Instagram read.";
  }
  if (normalized.includes("reach")) {
    return hasValue(metrics.reach)
      ? `Instagram reach is ${formatCount(metrics.reach)} on the latest read.`
      : "I could not retrieve the latest reach number yet, but the rest of the Instagram read is still available.";
  }
  if (normalized.includes("website click")) {
    return hasValue(metrics.websiteClicks)
      ? `Instagram sent ${formatCount(metrics.websiteClicks)} website clicks on the latest read.`
      : "I could not retrieve the latest Instagram website-click count yet.";
  }
  if (normalized.includes("performed best") || normalized.includes("best performing") || normalized.includes("top performing")) {
    return analytics.metadata.topContentText;
  }
  if (normalized.includes("post next")) {
    return [
      `I would build the next post from the strongest Instagram signal I can see. ${analytics.metadata.topContentText}`,
      "Recommendation: post a concise founder lesson about field-sales intelligence, pilot proof, or why outside sales needs direction before activity.",
      "Keep it public-safe: no private dashboards, route scoring, customer data, Anthony beta details, or proprietary mechanics."
    ].join(" ");
  }

  return analytics.body;
}

export async function createFounderInstagramDirectAnswer({
  command = "",
  service = getDefaultFounderSocialAnalyticsService()
} = {}) {
  const developerMode = isDeveloperModeRequest(command);
  const analytics = await createFounderInstagramAnalyticsBrief({ service, developerMode });

  return {
    title: "Instagram Analytics",
    body: developerMode
      ? analytics.body
      : directLeadForCommand(command, analytics, { developerMode }),
    metadata: {
      ...analytics.metadata,
      intent: "instagram_analytics_direct_query"
    }
  };
}
