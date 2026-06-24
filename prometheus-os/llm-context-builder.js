import { summarizeTruth } from "./evidence-ranker.js";

export function buildLlmContext({ question = "", intent = "general", context = {}, evidence = [] } = {}) {
  const rankedEvidence = evidence.slice(0, 10).map((item) => ({
    title: item.title,
    summary: item.summary,
    impact: item.impact,
    date: item.date,
    type: item.type,
    source: item.source,
    status: item.status,
    truth: item.truth,
    score: item.evidenceScore
  }));

  return {
    question,
    intent,
    conversation: {
      isFollowUp: context.isFollowUp,
      lastInput: context.lastInput,
      lastTitle: context.lastTitle,
      focusEntities: context.focusEntities || []
    },
    evidence: rankedEvidence,
    truth: summarizeTruth(evidence),
    instruction: "Generate one original Chief-of-Staff answer from ranked evidence. Do not read cards, quote files, or concatenate documentation."
  };
}
