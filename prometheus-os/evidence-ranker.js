import { daysSinceDate, normalizeText } from "./memory-ranking.js";

function daysSince(date) {
  return date ? daysSinceDate(date) : 30;
}

function includesAny(text, words) {
  return words.some((word) => text.includes(word));
}

function truthScore(truth) {
  if (truth === "verified") return 10;
  if (truth === "inferred") return 7;
  if (truth === "estimated") return 5;
  return 2;
}

function directConceptBoost(normalizedQuery, haystack) {
  const concepts = [
    "anthony",
    "chris",
    "google places",
    "google cloud",
    "meta",
    "instagram",
    "website",
    "github",
    "git hub",
    "cloudflare",
    "route intelligence",
    "prometheus companion",
    "companion",
    "pilot readiness",
    "pilot",
    "social media"
  ];

  return concepts.reduce((boost, concept) => {
    if (normalizedQuery.includes(concept) && haystack.includes(concept)) {
      return boost + (concept.includes(" ") ? 2.8 : 1.8);
    }
    return boost;
  }, 0);
}

function inferQuestionMode(normalizedQuery) {
  if (includesAny(normalizedQuery, ["executive", "leadership", "dallas", "larry", "phil", "approval"]) ||
      (normalizedQuery.includes("chris") && includesAny(normalizedQuery, ["ready", "readiness", "status", "tell", "ask"]))) {
    return "executive";
  }
  if (includesAny(normalizedQuery, ["what happened", "what changed", "yesterday", "today", "this week", "last month", "timeline"])) return "timeline";
  if (includesAny(normalizedQuery, ["what should", "highest roi", "what matters", "focus", "priority", "coo", "next"])) return "decision";
  if (includesAny(normalizedQuery, ["risk", "blocker", "blocked", "dependency"])) return "risk";
  if (includesAny(normalizedQuery, ["status", "ready", "readiness", "where are we", "rundown", "current", "update"])) return "state";
  return "general";
}

function sourceModeBoost(mode, item = {}) {
  const category = item.sourceCategory || item.type || "";
  const type = item.type || "";
  const haystack = normalizeText([
    item.id,
    item.title,
    item.summary,
    item.impact,
    item.source,
    ...(item.tags || []),
    ...(item.entities || [])
  ].filter(Boolean).join(" "));

  if (mode === "executive") {
    if (includesAny(haystack, ["social media", "instagram", "build-in-public"])) return -5;
    if (includesAny(haystack, ["executive", "leadership", "chris", "dallas", "larry", "phil", "approval", "pilot readiness"])) return 4;
    if (includesAny(haystack, ["anthony", "cloudflare", "github", "llc", "domain"])) return 2;
    if (category === "decision" && includesAny(haystack, ["follow-up", "pilot"])) return 2.5;
  }

  if (mode === "timeline") {
    if (type === "timeline-event" || category === "timeline") return 3.5;
    if (category === "project-context") return -1.2;
  }

  if (mode === "decision") {
    if (category === "decision" || type === "decision-engine-task") return 3.2;
    if (category === "dependency" || type === "blocked-event") return 1.8;
  }

  if (mode === "risk") {
    if (category === "dependency" || type === "blocked-event" || type === "unknown-operational-data") return 3.4;
    if (category === "decision") return 1.5;
  }

  if (mode === "state") {
    if (category === "company-state" || type === "company-state" || type === "status-card") return 3.4;
    if (category === "memory") return 1.1;
  }

  return 0;
}

export function rankEvidence(query = "", evidence = [], context = {}) {
  const primaryQuery = normalizeText(query);
  const normalizedQuery = normalizeText([
    query,
    context.lastInput,
    context.lastTitle,
    ...(context.focusEntities || [])
  ].filter(Boolean).join(" "));
  const queryTerms = normalizedQuery.split(" ").filter((term) => term.length > 2);
  const questionMode = inferQuestionMode(primaryQuery);

  return evidence
    .map((item) => {
      const haystack = normalizeText([
        item.title,
        item.summary,
        item.impact,
        item.reason,
        item.status,
        item.type,
        item.source,
        ...(item.tags || []),
        ...(item.entities || [])
      ].filter(Boolean).join(" "));

      const matchingTerms = queryTerms.filter((term) => haystack.includes(term)).length;
      const primaryTerms = primaryQuery.split(" ").filter((term) => term.length > 2);
      const primaryMatchingTerms = primaryTerms.filter((term) => haystack.includes(term)).length;
      const directBoost = directConceptBoost(primaryQuery, haystack);
      const recency = Math.max(0, 10 - daysSince(item.date));
      const founderRelevance = includesAny(haystack, ["cruz", "founder", "companion", "chief of staff", "memory"]) ? 9 : 5;
      const businessImpact = includesAny(haystack, ["pilot", "leadership", "executive", "revenue", "customer", "validation"]) ? 9 : 5;
      const pilotImportance = includesAny(haystack, ["anthony", "pilot", "route intelligence", "gps", "feedback", "validation"]) ? 10 : 4;
      const revenueImpact = includesAny(haystack, ["customer", "pilot", "leadership", "pricing", "revenue", "sales"]) ? 8 : 4;
      const conversationRelevance = Math.min(10, matchingTerms * 1.4 + primaryMatchingTerms * 1.6);
      const confidence = Number.isFinite(item.confidence) ? item.confidence * 10 : 7;
      const truth = truthScore(item.truth);
      const sourceFit = Number.isFinite(item.sourceFit) ? item.sourceFit : 5;
      const modeBoost = sourceModeBoost(questionMode, item);

      const score =
        recency * 0.15 +
        founderRelevance * 0.14 +
        businessImpact * 0.18 +
        pilotImportance * 0.18 +
        revenueImpact * 0.1 +
        conversationRelevance * 0.13 +
        sourceFit * 0.07 +
        confidence * 0.05 +
        truth * 0.05 +
        directBoost +
        modeBoost;

      return {
        ...item,
        evidenceScore: Number(score.toFixed(2)),
        ranking: {
          questionMode,
          directBoost,
          modeBoost,
          sourceFit,
          recency,
          founderRelevance,
          businessImpact,
          pilotImportance,
          revenueImpact,
          conversationRelevance,
          confidence,
          truth
        }
      };
    })
    .sort((a, b) => b.evidenceScore - a.evidenceScore);
}

export function summarizeTruth(evidence = []) {
  return evidence.reduce((summary, item) => {
    const truth = item.truth || "unknown";
    if (!summary[truth]) summary[truth] = [];
    summary[truth].push(item.title);
    return summary;
  }, { verified: [], inferred: [], estimated: [], unknown: [] });
}
