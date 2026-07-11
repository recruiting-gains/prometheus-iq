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

const METRIC_PROVENANCE = Object.freeze({
  VERIFIED: "verified",
  CALCULATED: "calculated",
  MISSING: "missing",
  UNSUPPORTED: "unsupported",
  STALE: "stale"
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
  return value !== null &&
    value !== undefined &&
    !(typeof value === "string" && value.trim() === "");
}

function finiteNumber(value) {
  if (!hasValue(value)) return null;
  if (typeof value !== "number" && typeof value !== "string") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function sourceMarkedStale(source) {
  const status = String(source?.status || source?.state || source?.metadata?.status || "").toLowerCase();
  return source?.stale === true || source?.metadata?.stale === true || status === METRIC_PROVENANCE.STALE;
}

function metricReading(value, {
  calculated = false,
  stale = false,
  source = "normalized source"
} = {}) {
  const numeric = finiteNumber(value);
  const provenance = !hasValue(value)
    ? METRIC_PROVENANCE.MISSING
    : numeric === null
      ? METRIC_PROVENANCE.UNSUPPORTED
      : stale
        ? METRIC_PROVENANCE.STALE
        : calculated
          ? METRIC_PROVENANCE.CALCULATED
          : METRIC_PROVENANCE.VERIFIED;
  return { value: numeric, provenance, source };
}

function calculatedReading(value, inputs, source) {
  const readings = asArray(inputs);
  if (!readings.length || readings.some(reading => finiteNumber(reading?.value) === null)) {
    const unsupported = readings.some(reading => reading?.provenance === METRIC_PROVENANCE.UNSUPPORTED);
    return {
      value: null,
      provenance: unsupported ? METRIC_PROVENANCE.UNSUPPORTED : METRIC_PROVENANCE.MISSING,
      source
    };
  }
  if (readings.some(reading => reading?.provenance === METRIC_PROVENANCE.STALE)) {
    return {
      value: null,
      provenance: METRIC_PROVENANCE.STALE,
      source: `${source}; calculation withheld because at least one required input is stale`
    };
  }
  return metricReading(value, {
    calculated: true,
    source
  });
}

function readingPresentation(label, reading, { percentageValue = false } = {}) {
  if (reading?.provenance === METRIC_PROVENANCE.MISSING) {
    return label === "engagement rate"
      ? "engagement rate cannot be calculated because the required source metrics are unavailable"
      : `${label} unavailable from the current snapshot`;
  }
  if (reading?.provenance === METRIC_PROVENANCE.UNSUPPORTED) {
    return label === "engagement rate"
      ? "engagement rate cannot be calculated because a required source metric is unsupported"
      : `${label} not reported in a supported numeric format`;
  }
  if (reading?.provenance === METRIC_PROVENANCE.STALE && reading?.value === null) {
    return `${label} unavailable because a required source metric is stale`;
  }
  const formatted = percentageValue ? percentage(reading?.value) : count(reading?.value);
  return `${formatted} ${label} (${reading?.provenance || METRIC_PROVENANCE.VERIFIED})`;
}

function signedCount(value) {
  const parsed = finiteNumber(value);
  return parsed === null ? "unavailable" : `${parsed >= 0 ? "+" : ""}${count(parsed)}`;
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
  if (!metrics.length) return metricReading(null, { source: "current Instagram snapshot" });
  const metric = metrics[0];
  return metricReading(metric.value, {
    stale: sourceMarkedStale(metric) || sourceMarkedStale(snapshot),
    source: `current Instagram snapshot:${metric.name}`
  });
}

function accountMetric(reportValue, report, snapshot, names) {
  const reportReading = metricReading(reportValue, {
    stale: sourceMarkedStale(report),
    source: "normalized Social Media report"
  });
  if (reportReading.value !== null) return reportReading;
  const snapshotReading = latestAccountMetric(snapshot, names);
  return snapshotReading.provenance !== METRIC_PROVENANCE.MISSING ? snapshotReading : reportReading;
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
      metrics: {},
      metricSources: {}
    };
    const metricName = metric.name.replace(/^content_/, "");
    current.metrics[metricName] = metric.value;
    current.metricSources[metricName] = metric;
    groups.set(id, current);
  }
  return [...groups.values()].map(normalizeContentMetrics);
}

function normalizeContentMetrics(group) {
  const metrics = group?.metrics || {};
  const metricSources = group?.metricSources || {};
  const readMetric = key => metricReading(metrics[key], {
    stale: sourceMarkedStale(metricSources[key]) || sourceMarkedStale(group),
    source: metricSources[key]?.name || `normalized content:${key}`
  });
  const likes = readMetric("likes");
  const comments = readMetric("comments");
  const shares = readMetric("shares");
  const saved = readMetric("saved");
  const componentReadings = [likes, comments, shares, saved];
  const directEngagementKey = ["total_interactions", "totalInteractions", "engagement"]
    .find(key => Object.prototype.hasOwnProperty.call(metrics, key));
  const directEngagement = directEngagementKey ? readMetric(directEngagementKey) : null;
  const engagement = directEngagement && directEngagement.value !== null
    ? directEngagement
    : componentReadings.every(reading => reading.value !== null)
      ? calculatedReading(
        componentReadings.reduce((total, reading) => total + reading.value, 0),
        componentReadings,
        "calculated from likes, comments, shares, and saves"
      )
      : directEngagement?.provenance === METRIC_PROVENANCE.UNSUPPORTED
        ? directEngagement
        : calculatedReading(null, componentReadings, "calculated from likes, comments, shares, and saves");
  const reach = readMetric("reach");
  const views = readMetric("views");
  const websiteClicks = readMetric("websiteClicks");
  const engagementRate = engagement.value !== null && reach.value !== null && reach.value > 0
    ? calculatedReading(
      Math.round((engagement.value / reach.value) * 10000) / 100,
      [engagement, reach],
      "calculated from content engagement and content reach"
    )
    : {
      value: null,
      provenance: reach.value === 0 ? METRIC_PROVENANCE.UNSUPPORTED : METRIC_PROVENANCE.MISSING,
      source: "requires content engagement and nonzero content reach"
    };
  return {
    ...group,
    metrics: {
      ...metrics,
      reach: reach.value,
      views: views.value,
      likes: likes.value,
      comments: comments.value,
      shares: shares.value,
      saved: saved.value,
      websiteClicks: websiteClicks.value,
      engagement: engagement.value,
      engagementRate: engagementRate.value
    },
    metricProvenance: {
      reach,
      views,
      likes,
      comments,
      shares,
      saved,
      websiteClicks,
      engagement,
      engagementRate
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
    const mergedMetrics = { ...(prior?.metrics || {}) };
    for (const [key, value] of Object.entries(item.metrics || {})) {
      const hasPrior = Object.prototype.hasOwnProperty.call(mergedMetrics, key);
      const priorNumeric = finiteNumber(mergedMetrics[key]);
      const incomingNumeric = finiteNumber(value);
      if (!hasPrior || incomingNumeric !== null || (priorNumeric === null && hasValue(value))) {
        mergedMetrics[key] = value;
      }
    }
    groups.set(item.mediaId, normalizeContentMetrics({
      ...prior,
      ...item,
      metrics: mergedMetrics,
      metricSources: { ...(prior?.metricSources || {}), ...(item.metricSources || {}) }
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
  const aggregateMetric = (metricName, sourceName = metricName) => {
    if (!groups.length) return metricReading(null, { source: `selected-period ${sourceName}` });
    const readings = groups.map(item => item.metricProvenance?.[metricName] || metricReading(item.metrics?.[metricName]));
    if (readings.some(reading => reading.value === null)) {
      return {
        value: null,
        provenance: readings.some(reading => reading.provenance === METRIC_PROVENANCE.UNSUPPORTED)
          ? METRIC_PROVENANCE.UNSUPPORTED
          : METRIC_PROVENANCE.MISSING,
        source: `selected-period ${sourceName}`
      };
    }
    return calculatedReading(
      readings.reduce((total, reading) => total + reading.value, 0),
      readings,
      `sum of verified ${sourceName} values in the selected period`
    );
  };

  const readings = {
    reach: aggregateMetric("reach"),
    views: aggregateMetric("views"),
    likes: aggregateMetric("likes"),
    comments: aggregateMetric("comments"),
    shares: aggregateMetric("shares"),
    saves: aggregateMetric("saved", "saves"),
    websiteClicks: aggregateMetric("websiteClicks", "website clicks"),
    engagements: aggregateMetric("engagement", "engagements")
  };
  return {
    reach: readings.reach.value,
    views: readings.views.value,
    likes: readings.likes.value,
    comments: readings.comments.value,
    shares: readings.shares.value,
    saves: readings.saves.value,
    websiteClicks: readings.websiteClicks.value,
    engagements: readings.engagements.value,
    metricProvenance: readings
  };
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
    const current = types.get(type) || [];
    current.push(item);
    types.set(type, current);
  }
  return [...types.entries()]
    .map(([type, items]) => ({ type, items, totals: aggregateContent(items) }))
    .sort((a, b) => (finiteNumber(b.totals.engagements) ?? -1) - (finiteNumber(a.totals.engagements) ?? -1))
    .map(({ type, items, totals }) => `${type}: ${items.length} posts, ${count(totals.engagements)} engagements, ${count(totals.reach)} reach`);
}

function performanceByDayTime(groups) {
  if (!groups.length) return "unavailable - no timestamped content in the selected period";
  const buckets = new Map();
  for (const item of groups) {
    const date = parseDate(item.publishedAt);
    if (!date) continue;
    const key = `${date.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" })} ${String(date.getUTCHours()).padStart(2, "0")}:00 UTC`;
    const current = buckets.get(key) || [];
    current.push(item);
    buckets.set(key, current);
  }
  const ranked = [...buckets.entries()]
    .map(([key, items]) => ({ key, items, engagement: aggregateContent(items).engagements }))
    .filter(item => finiteNumber(item.engagement) !== null)
    .sort((a, b) => b.engagement - a.engagement);
  const best = ranked[0];
  return best ? `${best.key} led with ${count(best.engagement)} engagements across ${best.items.length} post(s) (calculated)` : "unavailable - complete engagement metrics are not reported for the timestamped content";
}

function trendComparison(report) {
  const monthly = asArray(report?.growthTrends?.monthly).filter(row => row?.period && row.period !== "undated");
  if (monthly.length < 2) return null;
  const [previous, current] = monthly.slice(-2);
  const difference = (currentValue, previousValue) => {
    const currentNumber = finiteNumber(currentValue);
    const previousNumber = finiteNumber(previousValue);
    return currentNumber === null || previousNumber === null ? null : currentNumber - previousNumber;
  };
  return {
    previous,
    current,
    reach: difference(current.reach, previous.reach),
    engagement: difference(current.engagement, previous.engagement),
    websiteVisits: difference(current.websiteVisits, previous.websiteVisits),
    crmLeads: difference(current.crmLeads, previous.crmLeads)
  };
}

function anomalyText(report) {
  const daily = asArray(report?.growthTrends?.daily).filter(row => row?.period && row.period !== "undated");
  if (daily.length < 2) return "unknown - fewer than two comparable daily reads are available";
  const previous = daily.at(-2);
  const current = daily.at(-1);
  const currentEngagement = finiteNumber(current.engagement);
  const previousEngagement = finiteNumber(previous.engagement);
  const currentReach = finiteNumber(current.contentReach);
  const previousReach = finiteNumber(previous.contentReach);
  if ([currentEngagement, previousEngagement, currentReach, previousReach].some(value => value === null)) {
    return "unknown - the latest two daily reads do not contain every metric required for a comparison";
  }
  const engagementChange = currentEngagement - previousEngagement;
  const reachChange = currentReach - previousReach;
  if (!engagementChange && !reachChange) return "no material change in the latest two daily reads";
  return `latest daily change: ${signedCount(engagementChange)} engagements and ${signedCount(reachChange)} content reach (calculated)`;
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
  for (const [label, reading] of [
    ["followers or subscribers", account.followers],
    ["follower growth", account.followerGrowth],
    ["reach", account.reach],
    ["impressions", account.impressions],
    ["engagement rate", account.engagementRate],
    ["profile visits", account.profileVisits],
    ["link clicks", account.linkClicks],
    ["website clicks", account.websiteClicks]
  ]) {
    if ([METRIC_PROVENANCE.MISSING, METRIC_PROVENANCE.UNSUPPORTED].includes(reading?.provenance)) missing.push(label);
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
    followers: accountMetric(accountOverview.followers, report, snapshot, ["followers_count"]),
    followerGrowth: accountMetric(accountOverview.followerGrowth, report, snapshot, ["follower_growth", "followers_growth", "followers_delta"]),
    reach: accountMetric(accountOverview.reach, report, snapshot, ["reach"]),
    impressions: accountMetric(accountOverview.impressions, report, snapshot, ["impressions"]),
    profileVisits: accountMetric(accountOverview.profileVisits, report, snapshot, ["profile_views"]),
    websiteClicks: accountMetric(accountOverview.websiteClicks, report, snapshot, ["website_clicks"]),
    linkClicks: accountMetric(undefined, report, snapshot, ["link_clicks"]),
    engagementRate: accountMetric(accountOverview.engagementRate, report, snapshot, ["engagement_rate"])
  };
  const availability = providerAvailability(report, snapshot);
  const comparison = trendComparison(report);
  const top = [...selected].sort((a, b) => contentScore(b) - contentScore(a))[0] || null;
  const weakest = [...selected].sort((a, b) => contentScore(a) - contentScore(b))[0] || null;
  const sources = sourceLabels(report, snapshot);
  const missing = missingAnalytics({ report, snapshot, groups: selected, account, comparison });
  const websiteVisits = metricReading(report?.websiteAttribution?.websiteVisitsFromInstagram, {
    stale: sourceMarkedStale(report?.websiteAttribution) || sourceMarkedStale(report),
    source: "normalized Website attribution"
  });
  const leads = metricReading(report?.crmAttribution?.leadsGeneratedFromInstagram, {
    stale: sourceMarkedStale(report?.crmAttribution) || sourceMarkedStale(report),
    source: "normalized CRM attribution"
  });
  const conversionRate = metricReading(report?.crmAttribution?.conversionSummary?.visitToLeadRate, {
    stale: sourceMarkedStale(report?.crmAttribution) || sourceMarkedStale(report),
    source: "normalized CRM attribution"
  });
  const contentWebsiteLeader = report?.contentPerformance?.highestWebsiteTraffic || selected
    .filter(item => finiteNumber(item.metrics?.websiteClicks) !== null && finiteNumber(item.metrics?.websiteClicks) > 0)
    .sort((a, b) => finiteNumber(b.metrics.websiteClicks) - finiteNumber(a.metrics.websiteClicks))[0] || null;

  const selectedEngagementRate = totals.engagements !== null && totals.reach !== null && totals.reach > 0
    ? calculatedReading(
      Math.round((totals.engagements / totals.reach) * 10000) / 100,
      [totals.metricProvenance.engagements, totals.metricProvenance.reach],
      "calculated from complete selected-period engagement and reach"
    )
    : {
      value: null,
      provenance: [totals.metricProvenance.engagements, totals.metricProvenance.reach]
        .some(reading => reading?.provenance === METRIC_PROVENANCE.STALE)
        ? METRIC_PROVENANCE.STALE
        : totals.reach === 0 ? METRIC_PROVENANCE.UNSUPPORTED : METRIC_PROVENANCE.MISSING,
      source: "requires complete engagement and nonzero reach metrics"
    };

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
    metricProvenance: {
      supportedStates: Object.values(METRIC_PROVENANCE),
      account,
      selectedPeriod: {
        ...totals.metricProvenance,
        engagementRate: selectedEngagementRate
      },
      businessImpact: {
        websiteVisits,
        leads,
        conversionRate
      },
      content: selected.map(item => ({
        mediaId: item.mediaId,
        metrics: item.metricProvenance
      }))
    },
    presentationOnly: true,
    readOnly: true,
    directPlatformApiCalls: false,
    inputModes: ["voice", "text"]
  };

  if (normalized.includes("compare instagram and linkedin") || normalized.includes("compare linkedin and instagram")) {
    return {
      title: "Instagram and LinkedIn Comparison",
      body: [
        `Instagram is ${report?.account?.providerState || instagramProvider(snapshot)?.state || "partially available"}; latest refresh ${timestampLabel(generatedAt)}; ${readingPresentation("followers", account.followers)}, ${readingPresentation("reach", account.reach)}, ${count(totals.engagements)} selected-period engagements, and ${readingPresentation("website clicks", account.websiteClicks)}.`,
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
        ? `Verified from normalized attribution: ${contentLabel(contentWebsiteLeader)}. Total Instagram-attributed website visits: ${count(websiteVisits.value)}. Total attributed leads: ${count(leads.value)}.`
        : `No content-level website traffic leader is available in the latest normalized Social Media output. Account website clicks: ${count(account.websiteClicks.value)}. Attributed website visits: ${count(websiteVisits.value)}. Missing data: a normalized content-attribution event linking a post to website traffic.`,
      metadata: { ...metadata, contentWebsiteAttributionAvailable: Boolean(contentWebsiteLeader) }
    };
  }

  if (normalized.includes("previous month")) {
    return {
      title: "Social Media Month Comparison",
      body: comparison
        ? `${comparison.current.period} versus ${comparison.previous.period}: reach changed by ${signedCount(comparison.reach)}, engagement by ${signedCount(comparison.engagement)}, website visits by ${signedCount(comparison.websiteVisits)}, and CRM leads by ${signedCount(comparison.crmLeads)}. These are calculated only where both normalized monthly values are available.`
        : `Previous-month comparison is unavailable. The current normalized Social Media report does not include two comparable monthly periods. Latest verified refresh: ${timestampLabel(generatedAt)}. Required action: allow the Social Media reporting history to accumulate another normalized monthly period.`,
      metadata: { ...metadata, previousPeriodAvailable: Boolean(comparison) }
    };
  }

  const onlyInstagram = normalized.includes("show only instagram");
  const periodText = `${dateLabel(window.start)} through ${dateLabel(window.end)}`;
  const postingFrequency = selected.length ? `${Math.round((selected.length / window.days) * 100) / 100} posts per day (calculated)` : "unavailable";

  return {
    title: onlyInstagram ? "Instagram Analytics Briefing" : "Social Media Analytics Briefing",
    body: [
      `Executive summary: ${availability.included.length ? availability.included.map(item => SOCIAL_PROVIDER_LABELS[item]).join(", ") : "no platform"} data is included for ${periodText}. Latest refresh: ${timestampLabel(generatedAt)}. ${selected.length} posts produced ${count(totals.engagements)} engagements and ${count(totals.reach)} content reach.`,
      `Sources: ${sentenceList(sources, "Prometheus Social Media normalized analytics")}.`,
      onlyInstagram
        ? "Platform scope: Instagram only, as requested."
        : `Platforms included: ${sentenceList(availability.included.map(item => SOCIAL_PROVIDER_LABELS[item]))}. Platforms missing or disconnected: ${sentenceList(availability.missing.map(item => SOCIAL_PROVIDER_LABELS[item]))}.`,
      `Instagram account read: ${readingPresentation("followers", account.followers)}; ${readingPresentation("follower growth", account.followerGrowth)}; ${readingPresentation("account reach", account.reach)}; ${readingPresentation("impressions", account.impressions)}; ${readingPresentation("profile visits", account.profileVisits)}; ${readingPresentation("link clicks", account.linkClicks)}; ${readingPresentation("website clicks", account.websiteClicks)}; ${readingPresentation("engagement rate", account.engagementRate, { percentageValue: true })}.`,
      `Selected-period calculated metrics: ${count(totals.engagements)} engagements; ${count(totals.likes)} likes; ${count(totals.comments)} comments; ${count(totals.shares)} shares; ${count(totals.saves)} saves; ${count(totals.websiteClicks)} content-level website clicks; ${readingPresentation("engagement rate", selectedEngagementRate, { percentageValue: true })}; ${selected.length} posts; posting frequency ${postingFrequency}.`,
      `Top-performing post: ${contentLabel(top)}.`,
      `Weakest-performing post: ${contentLabel(weakest)}.`,
      `Performance by content type: ${sentenceList(performanceByType(selected), "unavailable")}.`,
      `Performance by posting day and time: ${performanceByDayTime(selected)}.`,
      `Trend analysis: ${comparison ? `${comparison.current.period} versus ${comparison.previous.period}: ${signedCount(comparison.engagement)} engagement and ${signedCount(comparison.reach)} reach (calculated where complete)` : "previous comparable period unavailable"}; anomalies: ${anomalyText(report)}.`,
      `Conversion and business impact: ${count(websiteVisits.value)} Instagram-attributed website visits; ${count(leads.value)} attributed leads; visit-to-lead rate ${percentage(conversionRate.value)}; content traffic leader ${contentLabel(contentWebsiteLeader)}.`,
      `Current content themes: ${themesFromReport(report)}.`,
      `Missing data: ${sentenceList(missing)}.`,
      `Recommended next action: ${recommendationFromReport(report)}`
    ].join(" "),
    metadata
  };
}
