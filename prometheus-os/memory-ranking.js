const rankingWeights = {
  recency: 0.24,
  businessImpact: 0.22,
  pilotImpact: 0.2,
  founderRelevance: 0.16,
  conversationRelevance: 0.14,
  statusSignal: 0.04
};

const currentDate = new Date("2026-06-24T12:00:00-05:00");

export function getPrometheusToday() {
  return currentDate.toISOString().slice(0, 10);
}

export function addDaysToIsoDate(date, days) {
  const parsed = new Date(`${date}T12:00:00-05:00`);
  if (Number.isNaN(parsed.getTime())) return getPrometheusToday();
  parsed.setDate(parsed.getDate() + days);
  return parsed.toISOString().slice(0, 10);
}

export function daysSinceDate(date) {
  const parsed = new Date(`${date}T12:00:00-05:00`);
  if (Number.isNaN(parsed.getTime())) return 30;
  return Math.max(0, Math.round((currentDate - parsed) / 86400000));
}

function daysSince(date) {
  return daysSinceDate(date);
}

function includesAny(haystack, needles) {
  return needles.some((needle) => haystack.includes(needle));
}

export function normalizeText(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/[’‘']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function inferMemoryIntent(query = "") {
  const normalized = normalizeText(query);
  if (includesAny(normalized, ["what should", "highest roi", "focus", "matters", "next", "before friday"])) return "priority";
  if (includesAny(normalized, ["yesterday"])) return "yesterday_recap";
  if (includesAny(normalized, ["this week", "weekly", "week"])) return "weekly_recap";
  if (includesAny(normalized, ["today", "changed today"])) return "today_recap";
  if (includesAny(normalized, ["since last login", "since login"])) return "since_last_login";
  if (includesAny(normalized, ["pilot readiness", "pilot status", "pilot ready", "pilot"])) return "pilot";
  if (includesAny(normalized, ["anthony"])) return "anthony";
  if (includesAny(normalized, ["chris"])) return "chris";
  if (includesAny(normalized, ["larry", "phil", "leadership", "dallas"])) return "leadership";
  if (includesAny(normalized, ["website", "site", "prometheusrouteiq"])) return "website";
  if (includesAny(normalized, ["github", "git"])) return "github";
  if (includesAny(normalized, ["cloudflare"])) return "cloudflare";
  if (includesAny(normalized, ["google places", "google api", "google maps"])) return "google_places";
  if (includesAny(normalized, ["blocker", "blocked", "risk", "falling behind"])) return "risk";
  if (includesAny(normalized, ["why", "explain", "break that down"])) return "why";
  return "general";
}

export function rankMemoryItems(items = [], query = "", context = {}) {
  const normalized = normalizeText(query);
  const contextText = normalizeText([
    context.lastInput,
    context.lastTitle,
    context.lastBody,
    ...(context.focusEntities || [])
  ].filter(Boolean).join(" "));

  return items
    .map((item) => {
      const haystack = normalizeText([
        item.title,
        item.summary,
        item.body,
        item.impact,
        item.status,
        ...(item.tags || []),
        ...(item.entities || []),
        item.type,
        item.source
      ].filter(Boolean).join(" "));

      const recency = item.date ? Math.max(0, 10 - daysSince(item.date)) : 5;
      const businessImpact = includesAny(haystack, ["executive", "leadership", "revenue", "pilot", "customer", "validation"]) ? 9 : 5;
      const pilotImpact = includesAny(haystack, ["anthony", "pilot", "route intelligence", "gps", "feedback", "validation"]) ? 9 : 4;
      const founderRelevance = includesAny(haystack, ["cruz", "founder", "companion", "chief of staff", "memory", "decision"]) ? 9 : 5;
      const queryTerms = normalized.split(" ").filter((term) => term.length > 2);
      const matchingTerms = queryTerms.filter((term) => haystack.includes(term)).length;
      const conversationTerms = contextText.split(" ").filter((term) => term.length > 3 && haystack.includes(term)).length;
      const conversationRelevance = Math.min(10, matchingTerms * 2 + conversationTerms);
      const statusSignal = item.status === "blocked" ? 8 : item.status === "in-progress" ? 7 : 5;

      const score =
        recency * rankingWeights.recency +
        businessImpact * rankingWeights.businessImpact +
        pilotImpact * rankingWeights.pilotImpact +
        founderRelevance * rankingWeights.founderRelevance +
        conversationRelevance * rankingWeights.conversationRelevance +
        statusSignal * rankingWeights.statusSignal;

      return {
        ...item,
        score: Number(score.toFixed(2)),
        rankingReasons: {
          recency,
          businessImpact,
          pilotImpact,
          founderRelevance,
          conversationRelevance,
          statusSignal
        }
      };
    })
    .sort((a, b) => b.score - a.score);
}
