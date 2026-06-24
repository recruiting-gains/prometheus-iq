import { normalizeText } from "./memory-ranking.js";

const currentDate = new Date("2026-06-24T12:00:00-05:00");

function daysSince(date) {
  if (!date) return 30;
  const parsed = new Date(`${date}T12:00:00-05:00`);
  if (Number.isNaN(parsed.getTime())) return 30;
  return Math.max(0, Math.round((currentDate - parsed) / 86400000));
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

export function rankEvidence(query = "", evidence = [], context = {}) {
  const normalizedQuery = normalizeText([
    query,
    context.lastInput,
    context.lastTitle,
    ...(context.focusEntities || [])
  ].filter(Boolean).join(" "));
  const queryTerms = normalizedQuery.split(" ").filter((term) => term.length > 2);

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
      const recency = Math.max(0, 10 - daysSince(item.date));
      const founderRelevance = includesAny(haystack, ["cruz", "founder", "companion", "chief of staff", "memory"]) ? 9 : 5;
      const businessImpact = includesAny(haystack, ["pilot", "leadership", "executive", "revenue", "customer", "validation"]) ? 9 : 5;
      const pilotImportance = includesAny(haystack, ["anthony", "pilot", "route intelligence", "gps", "feedback", "validation"]) ? 10 : 4;
      const revenueImpact = includesAny(haystack, ["customer", "pilot", "leadership", "pricing", "revenue", "sales"]) ? 8 : 4;
      const conversationRelevance = Math.min(10, matchingTerms * 2.2);
      const confidence = Number.isFinite(item.confidence) ? item.confidence * 10 : 7;
      const truth = truthScore(item.truth);

      const score =
        recency * 0.15 +
        founderRelevance * 0.14 +
        businessImpact * 0.18 +
        pilotImportance * 0.18 +
        revenueImpact * 0.1 +
        conversationRelevance * 0.15 +
        confidence * 0.05 +
        truth * 0.05;

      return {
        ...item,
        evidenceScore: Number(score.toFixed(2)),
        ranking: {
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
