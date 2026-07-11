import {
  SOCIAL_CONNECTION_STATES,
  SOCIAL_PROVIDER_IDS
} from "../social-media/contracts/social-media-contract.js";
import { getDefaultFounderSocialAnalyticsService } from "./founder-instagram-analytics-consumer.js";

const SOCIAL_PROVIDERS = [
  SOCIAL_PROVIDER_IDS.INSTAGRAM,
  SOCIAL_PROVIDER_IDS.FACEBOOK,
  SOCIAL_PROVIDER_IDS.LINKEDIN,
  SOCIAL_PROVIDER_IDS.X,
  SOCIAL_PROVIDER_IDS.TIKTOK,
  SOCIAL_PROVIDER_IDS.YOUTUBE
].filter(Boolean);

const SOCIAL_PROVIDER_LABELS = Object.freeze({
  [SOCIAL_PROVIDER_IDS.INSTAGRAM]: "Instagram",
  [SOCIAL_PROVIDER_IDS.FACEBOOK]: "Facebook",
  [SOCIAL_PROVIDER_IDS.LINKEDIN]: "LinkedIn",
  [SOCIAL_PROVIDER_IDS.X]: "X",
  [SOCIAL_PROVIDER_IDS.TIKTOK]: "TikTok",
  [SOCIAL_PROVIDER_IDS.YOUTUBE]: "YouTube"
});

function normalizeCommand(command = "") {
  return String(command || "")
    .toLowerCase()
    .replace(/[’‘']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function hasValue(value) {
  return value !== null && value !== undefined && value !== "";
}

function finiteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function count(value) {
  const parsed = finiteNumber(value);
  return parsed === null ? "unavailable" : new Intl.NumberFormat("en-US").format(parsed);
}

function percentage(value) {
  const parsed = finiteNumber(value);
  return parsed === null ? "unavailable" : `${Math.round(parsed * 100) / 100}%`;
}

function sentenceList(items = [], empty = "none") {
  const values = asArray(items).map(item => String(item || "").trim()).filter(Boolean);
  return values.length ? values.join("; ") : empty;
}

function parseDate(value) {
  if (!value) return null;
  const normalized = String(value).replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateLabel(value) {
  const date = value instanceof Date ? value : parseDate(value);
  return date ? date.toISOString().slice(0, 10) : "unavailable";
}

function timestampLabel(value) {
  const date = parseDate(value);
  return date ? date.toISOString() : "unavailable";
}

function titleCase(value = "") {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, letter => letter.toUpperCase());
}

export function isFounderInfrastructureBriefingCommand(command = "") {
  const normalized = normalizeCommand(command);
  return [
    "infrastructure",
    "infrastructure briefing",
    "infrastructure status",
    "current infrastructure",
    "give me infrastructure"
  ].includes(normalized);
}

export function isFounderSocialMediaBriefingCommand(command = "") {
  const normalized = normalizeCommand(command);
  if (!normalized) return false;

  if ([
    "social",
    "social media",
    "social media analytics",
    "social media briefing",
    "social media summary",
    "social media status",
    "show social media",
    "summarize social",
    "social status",
    "marketing summary"
  ].includes(normalized)) return true;

  if (normalized.includes("social media") && (
    normalized.includes("last seven days") ||
    normalized.includes("last 7 days") ||
    normalized.includes("last thirty days") ||
    normalized.includes("last 30 days") ||
    normalized.includes("analytics") ||
    normalized.includes("brief")
  )) return true;

  return [
    "compare instagram and linkedin",
    "compare linkedin and instagram",
    "show only instagram",
    "which content drove the most website traffic",
    "what changed from the previous month",
    "what changed from previous month"
  ].some(phrase => normalized.includes(phrase));
}

export function createFounderInfrastructureBriefing({ founderTimeline = null } = {}) {
  const infrastructure = founderTimeline?.infrastructure;
  if (!infrastructure) {
    return {
      title: "Infrastructure Briefing",
      body: [
        "Infrastructure briefing unavailable.",
        "The canonical Infrastructure state is missing from the local Founder Timeline.",
        "Last verified data: unavailable.",
        "Required action: restore the read-only Founder Timeline source and rerun Companion verification. No Infrastructure setting was changed."
      ].join(" "),
      metadata: {
        intent: "infrastructure_direct_briefing",
        sourceSubsystem: "Prometheus Infrastructure",
        stateAvailable: false,
        presentationOnly: true,
        readOnly: true,
        inputModes: ["voice", "text"]
      }
    };
  }

  const repository = infrastructure.repository || {};
  const repositorySync = repository.syncState === "synchronized"
    ? `${repository.branch || "current branch"} matches ${repository.upstream || "its local upstream"} at ${repository.commit || "an unrecorded commit"}`
    : repository.syncState === "out_of_sync"
      ? `${repository.branch || "current branch"} differs from ${repository.upstream || "its local upstream"}: ${repository.ahead || 0} ahead, ${repository.behind || 0} behind`
      : "repository synchronization is not verified";

  const deployment = infrastructure.deploymentVersion?.value
    ? infrastructure.deploymentVersion.value
    : `unknown - ${infrastructure.deploymentVersion?.detail || "the latest verified Infrastructure checkpoint does not record a deployment version"}`;

  const milestone = infrastructure.latestMilestone
    ? `${infrastructure.latestMilestone.date}: ${infrastructure.latestMilestone.title} - ${infrastructure.latestMilestone.status}`
    : "unavailable";

  return {
    title: "Infrastructure Briefing",
    body: [
      `Overall status: ${infrastructure.overallStatus || "UNKNOWN"} (${infrastructure.overallStatusEvidence || "working judgment"}). ${infrastructure.overallStatusReason || "No status rationale is available."}`,
      `Current phase: ${sentenceList(infrastructure.operationalPhase, "unavailable")}.`,
      `Verified facts: production ${infrastructure.productionAvailability?.detail || "status unavailable"}; Cloudflare Worker ${infrastructure.cloudflareWorker?.detail || "status unavailable"}; Access and authentication ${infrastructure.accessAuth?.detail || "status unavailable"}; Operation Aegis ${infrastructure.aegis?.detail || "status unavailable"}; WAF and rate limiting ${infrastructure.wafRateLimiting?.detail || "status unavailable"}.`,
      `Deployment version: ${deployment}.`,
      `Repository: ${repositorySync}${repository.dirty ? "; working tree has local changes" : "; working tree clean"}.`,
      `Latest completed milestone: ${milestone}.`,
      `Active Infrastructure work: ${sentenceList(infrastructure.activeWork)}.`,
      `Active blockers: ${sentenceList(infrastructure.activeBlockers)}.`,
      `Founder or account-owner actions: ${sentenceList(infrastructure.founderActions)}.`,
      `Plan or permission limitations: ${sentenceList(infrastructure.limitations)}.`,
      `Latest verified: ${infrastructure.latestVerifiedAt || "unavailable"}.`,
      `Recommendation: ${infrastructure.recommendedNextAction || "No verified next action is recorded."}`
    ].join(" "),
    metadata: {
      intent: "infrastructure_direct_briefing",
      sourceSubsystem: "Prometheus Infrastructure",
      canonicalSources: asArray(infrastructure.sources),
      latestVerifiedAt: infrastructure.latestVerifiedAt || null,
      overallStatus: infrastructure.overallStatus || "UNKNOWN",
      activeBlockerCount: asArray(infrastructure.activeBlockers).length,
      presentationOnly: true,
      readOnly: true,
      inputModes: ["voice", "text"]
    }
  };
}

function unwrapReport(payload) {
  return payload?.report || payload?.data?.report || payload || null;
}

function instagramProvider(snapshot) {
  return asArray(snapshot?.providers).find(item => item?.provider === SOCIAL_PROVIDER_IDS.INSTAGRAM) || null;
}

function latestAccountMetric(snapshot, names = []) {
  const metrics = asArray(snapshot?.metrics)
    .filter(metric => metric?.provider === SOCIAL_PROVIDER_IDS.INSTAGRAM && metric?.metadata?.scope !== "content" && names.includes(metric?.name))
    .sort((a, b) => String(b.observedAt || "").localeCompare(String(a.observedAt || "")));
  return metrics.length ? finiteNumber(metrics[0].value) : null;
}

function snapshotContent(snapshot) {
  const groups = new Map();
  for (const metric of asArray(snapshot?.metrics)) {
    if (metric?.provider !== SOCIAL_PROVIDER_IDS.INSTAGRAM || metric?.metadata?.scope !== "content") continue;
    const id = metric.metadata?.mediaId;
    if (!id) continue;
    const current = groups.get(id) || {
      mediaId: id,
      mediaType: metric.metadata?.mediaType || "UNKNOWN",
      publishedAt: metric.metadata?.publishedAt || null,
      captionPreview: metric.metadata?.captionPreview || "",
      permalink: metric.metadata?.permalink || null,
      metrics: {}
    };
    current.metrics[metric.name.replace(/^content_/, "")] = finiteNumber(metric.value) || 0;
    groups.set(id, current);
  }
  return [...groups.values()].map(normalizeContentMetrics);
}

function normalizeContentMetrics(group) {
  const metrics = group?.metrics || {};
  const likes = finiteNumber(metrics.likes) || 0;
  const comments = finiteNumber(metrics.comments) || 0;
  const shares = finiteNumber(metrics.shares) || 0;
  const saved = finiteNumber(metrics.saved) || 0;
  const engagement = finiteNumber(metrics.engagement) ?? finiteNumber(metrics.totalInteractions) ?? (likes + comments + shares + saved);
  const reach = finiteNumber(metrics.reach) ?? finiteNumber(metrics.views) ?? 0;
  return {
    ...group,
    metrics: {
      ...metrics,
      reach,
      views: finiteNumber(metrics.views) || 0,
      likes,
      comments,
      shares,
      saved,
      websiteClicks: finiteNumber(metrics.websiteClicks) || 0,
      engagement,
      engagementRate: reach ? Math.round((engagement / reach) * 10000) / 100 : 0
    }
  };
}

function reportContent(report) {
  const performance = report?.contentPerformance || {};
  const candidates = [
    ...asArray(performance.topPerformingPosts),
    ...asArray(performance.topPerformingReels),
    ...asArray(performance.topPerformingCarousels),
    performance.highestEngagement,
    performance.highestWebsiteTraffic,
    performance.highestReach
  ].filter(Boolean);
  const groups = new Map();
  for (const item of candidates) {
    const id = item.mediaId || item.id;
    if (!id) continue;
    groups.set(id, normalizeContentMetrics({ ...item, mediaId: id }));
  }
  return [...groups.values()];
}

function mergedContent(report, snapshot) {
  const groups = new Map(reportContent(report).map(item => [item.mediaId, item]));
  for (const item of snapshotContent(snapshot)) {
    const prior = groups.get(item.mediaId);
    groups.set(item.mediaId, normalizeContentMetrics({
      ...prior,
      ...item,
      metrics: { ...(prior?.metrics || {}), ...(item.metrics || {}) }
    }));
  }
  return [...groups.values()];
}

function requestedWindow(command, generatedAt, groups) {
  const normalized = normalizeCommand(command);
  const end = parseDate(generatedAt) || new Date();
  end.setUTCHours(23, 59, 59, 999);
  const requestedDays = normalized.includes("last seven days") || normalized.includes("last 7 days")
    ? 7
    : normalized.includes("last thirty days") || normalized.includes("last 30 days")
      ? 30
      : null;

  if (requestedDays) {
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - (requestedDays - 1));
    start.setUTCHours(0, 0, 0, 0);
    return { start, end, days: requestedDays, requested: true };
  }

  const dates = groups.map(item => parseDate(item.publishedAt)).filter(Boolean).sort((a, b) => a - b);
  if (dates.length) {
    const start = new Date(dates[0]);
    const latest = new Date(dates.at(-1));
    start.setUTCHours(0, 0, 0, 0);
    latest.setUTCHours(23, 59, 59, 999);
    const days = Math.max(1, Math.round((latest - start) / 86_400_000) + 1);
    return { start, end: latest, days, requested: false };
  }

  const start = new Date(end);
  start.setUTCHours(0, 0, 0, 0);
  return { start, end, days: 1, requested: false, pointInTime: true };
}

function contentInsideWindow(groups, window) {
  return groups.filter(item => {
    const publishedAt = parseDate(item.publishedAt);
    return publishedAt && publishedAt >= window.start && publishedAt <= window.end;
  });
}

function aggregateContent(groups) {
  return groups.reduce((total, item) => {
    const metrics = item.metrics || {};
    total.reach += finiteNumber(metrics.reach) || 0;
    total.views += finiteNumber(metrics.views) || 0;
    total.likes += finiteNumber(metrics.likes) || 0;
    total.comments += finiteNumber(metrics.comments) || 0;
    total.shares += finiteNumber(metrics.shares) || 0;
    total.saves += finiteNumber(metrics.saved) || 0;
    total.websiteClicks += finiteNumber(metrics.websiteClicks) || 0;
    total.engagements += finiteNumber(metrics.engagement) || 0;
    return total;
  }, {
    reach: 0,
    views: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    saves: 0,
    websiteClicks: 0,
    engagements: 0
  });
}

function contentScore(item) {
  return finiteNumber(item?.metrics?.engagement) ?? finiteNumber(item?.metrics?.reach) ?? finiteNumber(item?.metrics?.views) ?? 0;
}

function contentLabel(item) {
  if (!item) return "unavailable";
  const caption = String(item.captionPreview || "").replace(/\s+/g, " ").trim();
  const preview = caption ? ` - ${caption.slice(0, 100)}${caption.length > 100 ? "..." : ""}` : "";
  return `${titleCase(item.mediaType || "content")} on ${dateLabel(item.publishedAt)}${preview}; ${count(item.metrics?.engagement)} engagements, ${count(item.metrics?.reach)} reach, ${count(item.metrics?.websiteClicks)} content-level website clicks`;
}

function performanceByType(groups) {
  const types = new Map();
  for (const item of groups) {
    const type = titleCase(item.mediaType || "unknown");
    const current = types.get(type) || { posts: 0, engagement: 0, reach: 0 };
    current.posts += 1;
    current.engagement += finiteNumber(item.metrics?.engagement) || 0;
    current.reach += finiteNumber(item.metrics?.reach) || 0;
    types.set(type, current);
  }
  return [...types.entries()]
    .sort((a, b) => b[1].engagement - a[1].engagement)
    .map(([type, value]) => `${type}: ${value.posts} posts, ${count(value.engagement)} engagements, ${count(value.reach)} reach`);
}

function performanceByDayTime(groups) {
  if (!groups.length) return "unavailable - no timestamped content in the selected period";
  const buckets = new Map();
  for (const item of groups) {
    const date = parseDate(item.publishedAt);
    if (!date) continue;
    const key = `${date.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" })} ${String(date.getUTCHours()).padStart(2, "0")}:00 UTC`;
    const current = buckets.get(key) || { posts: 0, engagement: 0 };
    current.posts += 1;
    current.engagement += finiteNumber(item.metrics?.engagement) || 0;
    buckets.set(key, current);
  }
  const best = [...buckets.entries()].sort((a, b) => b[1].engagement - a[1].engagement)[0];
  return best ? `${best[0]} led with ${count(best[1].engagement)} engagements across ${best[1].posts} post(s) (calculated)` : "unavailable";
}

function trendComparison(report) {
  const monthly = asArray(report?.growthTrends?.monthly).filter(row => row?.period && row.period !== "undated");
  if (monthly.length < 2) return null;
  const [previous, current] = monthly.slice(-2);
  return {
    previous,
    current,
    reach: (finiteNumber(current.reach) || 0) - (finiteNumber(previous.reach) || 0),
    engagement: (finiteNumber(current.engagement) || 0) - (finiteNumber(previous.engagement) || 0),
    websiteVisits: (finiteNumber(current.websiteVisits) || 0) - (finiteNumber(previous.websiteVisits) || 0),
    crmLeads: (finiteNumber(current.crmLeads) || 0) - (finiteNumber(previous.crmLeads) || 0)
  };
}

function anomalyText(report) {
  const daily = asArray(report?.growthTrends?.daily).filter(row => row?.period && row.period !== "undated");
  if (daily.length < 2) return "unknown - fewer than two comparable daily reads are available";
  const previous = daily.at(-2);
  const current = daily.at(-1);
  const engagementChange = (finiteNumber(current.engagement) || 0) - (finiteNumber(previous.engagement) || 0);
  const reachChange = (finiteNumber(current.contentReach) || 0) - (finiteNumber(previous.contentReach) || 0);
  if (!engagementChange && !reachChange) return "no material change in the latest two daily reads";
  return `latest daily change: ${engagementChange >= 0 ? "+" : ""}${count(engagementChange)} engagements and ${reachChange >= 0 ? "+" : ""}${count(reachChange)} content reach (calculated)`;
}

function recommendationFromReport(report) {
  const recommendation = asArray(report?.founderRecommendations)
    .find(item => String(item?.title || "").toLowerCase() === "suggested next post") ||
    asArray(report?.founderRecommendations)[0];
  return recommendation?.recommendation || "Restore missing normalized analytics before changing the content plan.";
}

function themesFromReport(report) {
  const themes = asArray(report?.founderRecommendations)
    .find(item => String(item?.title || "").toLowerCase() === "recommended content topics");
  return themes?.recommendation || "unknown - the normalized report did not provide a current content-theme read";
}

function sourceLabels(report, snapshot) {
  const labels = new Set(asArray(report?.sourceAudit).map(item => item?.source).filter(Boolean));
  if (snapshot) labels.add("Prometheus Social Media normalized analytics");
  return [...labels];
}

function missingAnalytics({ report, snapshot, groups, account, comparison }) {
  const missing = [];
  for (const [label, value] of [
    ["followers or subscribers", account.followers],
    ["follower growth", account.followerGrowth],
    ["reach", account.reach],
    ["impressions", account.impressions],
    ["engagement rate", account.engagementRate],
    ["profile visits", account.profileVisits],
    ["link clicks", account.linkClicks],
    ["website clicks", account.websiteClicks]
  ]) {
    if (!hasValue(value)) missing.push(label);
  }
  if (!groups.length) missing.push("content-level performance");
  if (!report?.websiteAttribution) missing.push("website attribution");
  if (!report?.crmAttribution) missing.push("lead and conversion attribution");
  missing.push("audience demographics");
  if (!comparison) missing.push("previous comparable monthly period");
  if (!report && !snapshot) missing.push("normalized Social Media report and snapshot");
  return [...new Set(missing)];
}

function providerAvailability(report, snapshot) {
  const provider = instagramProvider(snapshot);
  const instagramConnected = provider?.state === SOCIAL_CONNECTION_STATES.CONNECTED || report?.account?.providerState === SOCIAL_CONNECTION_STATES.CONNECTED;
  const included = instagramConnected || report || snapshot ? [SOCIAL_PROVIDER_IDS.INSTAGRAM] : [];
  return {
    included,
    missing: SOCIAL_PROVIDERS.filter(item => !included.includes(item))
  };
}

function socialUnavailable(service) {
  const lastVerified = service?.lastVerifiedAt || "unavailable";
  return {
    title: "Social Media Analytics Briefing",
    body: [
      "Social Media analytics are unavailable.",
      "Unavailable analytics: followers or subscribers, growth, reach, impressions, engagement, content performance, website traffic, and lead attribution.",
      "Missing connection or artifact: the normalized Prometheus Social Media report and Instagram snapshot.",
      `Last verified data: ${lastVerified}.`,
      "Required action: restore the read-only normalized Social Media report/snapshot connection. Companion did not call a social platform or modify Social Media."
    ].join(" "),
    metadata: {
      intent: "social_media_direct_briefing",
      sourceSubsystem: "Prometheus Social Media",
      analyticsAvailable: false,
      lastVerifiedAt: lastVerified === "unavailable" ? null : lastVerified,
      presentationOnly: true,
      readOnly: true,
      directPlatformApiCalls: false,
      inputModes: ["voice", "text"]
    }
  };
}

export async function createFounderSocialMediaBriefing({
  command = "social media",
  service = getDefaultFounderSocialAnalyticsService()
} = {}) {
  const [reportPayload, snapshot] = await Promise.all([
    typeof service?.getInstagramAnalyticsReport === "function" ? service.getInstagramAnalyticsReport() : null,
    typeof service?.getInstagramAnalyticsSnapshot === "function" ? service.getInstagramAnalyticsSnapshot() : null
  ]);
  const report = unwrapReport(reportPayload);
  if (!report && !snapshot) return socialUnavailable(service);

  const normalized = normalizeCommand(command);
  const groups = mergedContent(report, snapshot);
  const generatedAt = report?.generatedAt || snapshot?.generatedAt || null;
  const window = requestedWindow(command, generatedAt, groups);
  const selected = contentInsideWindow(groups, window);
  const totals = aggregateContent(selected);
  const accountOverview = report?.accountOverview || {};
  const account = {
    followers: hasValue(accountOverview.followers) ? finiteNumber(accountOverview.followers) : latestAccountMetric(snapshot, ["followers_count"]),
    followerGrowth: hasValue(accountOverview.followerGrowth) ? finiteNumber(accountOverview.followerGrowth) : latestAccountMetric(snapshot, ["follower_growth", "followers_growth", "followers_delta"]),
    reach: hasValue(accountOverview.reach) ? finiteNumber(accountOverview.reach) : latestAccountMetric(snapshot, ["reach"]),
    impressions: hasValue(accountOverview.impressions) ? finiteNumber(accountOverview.impressions) : latestAccountMetric(snapshot, ["impressions"]),
    profileVisits: hasValue(accountOverview.profileVisits) ? finiteNumber(accountOverview.profileVisits) : latestAccountMetric(snapshot, ["profile_views"]),
    websiteClicks: hasValue(accountOverview.websiteClicks) ? finiteNumber(accountOverview.websiteClicks) : latestAccountMetric(snapshot, ["website_clicks"]),
    linkClicks: latestAccountMetric(snapshot, ["link_clicks"]),
    engagementRate: hasValue(accountOverview.engagementRate) ? finiteNumber(accountOverview.engagementRate) : (totals.reach ? Math.round((totals.engagements / totals.reach) * 10000) / 100 : null)
  };
  const availability = providerAvailability(report, snapshot);
  const comparison = trendComparison(report);
  const top = [...selected].sort((a, b) => contentScore(b) - contentScore(a))[0] || null;
  const weakest = [...selected].sort((a, b) => contentScore(a) - contentScore(b))[0] || null;
  const sources = sourceLabels(report, snapshot);
  const missing = missingAnalytics({ report, snapshot, groups: selected, account, comparison });
  const websiteVisits = finiteNumber(report?.websiteAttribution?.websiteVisitsFromInstagram);
  const leads = finiteNumber(report?.crmAttribution?.leadsGeneratedFromInstagram);
  const conversionRate = finiteNumber(report?.crmAttribution?.conversionSummary?.visitToLeadRate);
  const contentWebsiteLeader = report?.contentPerformance?.highestWebsiteTraffic || selected
    .filter(item => (finiteNumber(item.metrics?.websiteClicks) || 0) > 0)
    .sort((a, b) => (b.metrics.websiteClicks || 0) - (a.metrics.websiteClicks || 0))[0] || null;

  const metadata = {
    intent: "social_media_direct_briefing",
    sourceSubsystem: "Prometheus Social Media",
    analyticsAvailable: true,
    reportingPeriod: {
      startsAt: dateLabel(window.start),
      endsAt: dateLabel(window.end),
      pointInTime: Boolean(window.pointInTime)
    },
    lastVerifiedAt: generatedAt,
    includedPlatforms: availability.included.map(item => SOCIAL_PROVIDER_LABELS[item] || titleCase(item)),
    missingPlatforms: availability.missing.map(item => SOCIAL_PROVIDER_LABELS[item] || titleCase(item)),
    canonicalSources: sources,
    presentationOnly: true,
    readOnly: true,
    directPlatformApiCalls: false,
    inputModes: ["voice", "text"]
  };

  if (normalized.includes("compare instagram and linkedin") || normalized.includes("compare linkedin and instagram")) {
    return {
      title: "Instagram and LinkedIn Comparison",
      body: [
        `Instagram is ${report?.account?.providerState || instagramProvider(snapshot)?.state || "partially available"}; latest refresh ${timestampLabel(generatedAt)}; ${count(account.followers)} followers, ${count(account.reach)} reach, ${count(totals.engagements)} selected-period engagements, and ${count(account.websiteClicks)} website clicks.`,
        "LinkedIn analytics are unavailable because no normalized LinkedIn connection or analytics artifact was included in the current Prometheus Social Media output.",
        "A cross-platform comparison cannot be calculated until that normalized LinkedIn artifact is available."
      ].join(" "),
      metadata: { ...metadata, comparisonAvailable: false }
    };
  }

  if (normalized.includes("which content drove the most website traffic")) {
    return {
      title: "Social Website Traffic",
      body: contentWebsiteLeader
        ? `Verified from normalized attribution: ${contentLabel(contentWebsiteLeader)}. Total Instagram-attributed website visits: ${count(websiteVisits)}. Total attributed leads: ${count(leads)}.`
        : `No content-level website traffic leader is available in the latest normalized Social Media output. Account website clicks: ${count(account.websiteClicks)}. Attributed website visits: ${count(websiteVisits)}. Missing data: a normalized content-attribution event linking a post to website traffic.`,
      metadata: { ...metadata, contentWebsiteAttributionAvailable: Boolean(contentWebsiteLeader) }
    };
  }

  if (normalized.includes("previous month")) {
    return {
      title: "Social Media Month Comparison",
      body: comparison
        ? `${comparison.current.period} versus ${comparison.previous.period}: reach changed by ${comparison.reach >= 0 ? "+" : ""}${count(comparison.reach)}, engagement by ${comparison.engagement >= 0 ? "+" : ""}${count(comparison.engagement)}, website visits by ${comparison.websiteVisits >= 0 ? "+" : ""}${count(comparison.websiteVisits)}, and CRM leads by ${comparison.crmLeads >= 0 ? "+" : ""}${count(comparison.crmLeads)}. These are calculated from normalized monthly rows.`
        : `Previous-month comparison is unavailable. The current normalized Social Media report does not include two comparable monthly periods. Latest verified refresh: ${timestampLabel(generatedAt)}. Required action: allow the Social Media reporting history to accumulate another normalized monthly period.`,
      metadata: { ...metadata, previousPeriodAvailable: Boolean(comparison) }
    };
  }

  const onlyInstagram = normalized.includes("show only instagram");
  const periodText = `${dateLabel(window.start)} through ${dateLabel(window.end)}`;
  const postingFrequency = selected.length ? `${Math.round((selected.length / window.days) * 100) / 100} posts per day (calculated)` : "unavailable";
  const normalizedEngagementRate = totals.reach ? Math.round((totals.engagements / totals.reach) * 10000) / 100 : null;

  return {
    title: onlyInstagram ? "Instagram Analytics Briefing" : "Social Media Analytics Briefing",
    body: [
      `Executive summary: ${availability.included.length ? availability.included.map(item => SOCIAL_PROVIDER_LABELS[item]).join(", ") : "no platform"} data is included for ${periodText}. Latest refresh: ${timestampLabel(generatedAt)}. ${selected.length} posts produced ${count(totals.engagements)} engagements and ${count(totals.reach)} content reach.`,
      `Sources: ${sentenceList(sources, "Prometheus Social Media normalized analytics")}.`,
      onlyInstagram
        ? "Platform scope: Instagram only, as requested."
        : `Platforms included: ${sentenceList(availability.included.map(item => SOCIAL_PROVIDER_LABELS[item]))}. Platforms missing or disconnected: ${sentenceList(availability.missing.map(item => SOCIAL_PROVIDER_LABELS[item]))}.`,
      `Instagram account read: ${count(account.followers)} followers; growth ${count(account.followerGrowth)}; account reach ${count(account.reach)}; impressions ${count(account.impressions)}; profile visits ${count(account.profileVisits)}; link clicks ${count(account.linkClicks)}; website clicks ${count(account.websiteClicks)}; normalized engagement rate ${percentage(account.engagementRate)}.`,
      `Selected-period calculated metrics: ${count(totals.engagements)} engagements; ${count(totals.likes)} likes; ${count(totals.comments)} comments; ${count(totals.shares)} shares; ${count(totals.saves)} saves; ${count(totals.websiteClicks)} content-level website clicks; engagement rate ${percentage(normalizedEngagementRate)}; ${selected.length} posts; posting frequency ${postingFrequency}.`,
      `Top-performing post: ${contentLabel(top)}.`,
      `Weakest-performing post: ${contentLabel(weakest)}.`,
      `Performance by content type: ${sentenceList(performanceByType(selected), "unavailable")}.`,
      `Performance by posting day and time: ${performanceByDayTime(selected)}.`,
      `Trend analysis: ${comparison ? `${comparison.current.period} versus ${comparison.previous.period}: ${comparison.engagement >= 0 ? "+" : ""}${count(comparison.engagement)} engagement and ${comparison.reach >= 0 ? "+" : ""}${count(comparison.reach)} reach (calculated)` : "previous comparable period unavailable"}; anomalies: ${anomalyText(report)}.`,
      `Conversion and business impact: ${count(websiteVisits)} Instagram-attributed website visits; ${count(leads)} attributed leads; visit-to-lead rate ${percentage(conversionRate)}; content traffic leader ${contentLabel(contentWebsiteLeader)}.`,
      `Current content themes: ${themesFromReport(report)}.`,
      `Missing data: ${sentenceList(missing)}.`,
      `Recommended next action: ${recommendationFromReport(report)}`
    ].join(" "),
    metadata
  };
}
