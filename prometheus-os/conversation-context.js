import { createEntityBrief, resolveEntityKey } from "./knowledge-graph.js";
import { createDecisionEngineSummary } from "./decision-engine.js";

const followUpPatterns = [
  /^why\b/,
  /^why that\b/,
  /^explain\b/,
  /^break that down\b/,
  /^tell me more\b/,
  /^what do you mean\b/,
  /^what about\b/,
  /^and what about\b/,
  /^how about\b/,
  /^what about the\b/
];

export function isContextualFollowUp(command = "") {
  const normalized = String(command).toLowerCase().trim();
  return followUpPatterns.some((pattern) => pattern.test(normalized));
}

function lastAnswerSummary(lastEntry) {
  if (!lastEntry?.response) return "your last question";
  return `${lastEntry.response.title}: ${lastEntry.response.body}`;
}

export function createContextualFollowUpResponse(command = "", lastEntry) {
  const normalized = String(command).toLowerCase().trim();
  const entityKey = resolveEntityKey(normalized);

  if (entityKey) {
    const entityBrief = createEntityBrief(entityKey);
    return {
      title: entityBrief.title,
      body: [
        entityBrief.body,
        "Context from the last answer still matters: keep this tied to the highest-leverage founder action instead of turning it into a random side quest."
      ].join(" ")
    };
  }

  if (/^why/.test(normalized) || normalized.includes("why that")) {
    const decision = createDecisionEngineSummary();
    return {
      title: "Why that matters",
      body: [
        `Your last answer was about ${lastAnswerSummary(lastEntry)}`,
        "The reason it matters is company leverage: the best work right now should increase pilot proof, reduce founder risk, or make Prometheus easier to operate.",
        decision.body,
        "Prometheus gets closer to a real company when the next action produces evidence, not just more polish."
      ].join(" ")
    };
  }

  return {
    title: "Context follow-up",
    body: [
      `I am connecting that follow-up to ${lastAnswerSummary(lastEntry)}`,
      "Ask me about Anthony, Chris, the pilot, the website, GitHub, Cloudflare, Route Intelligence, or social media and I will pull the specific memory profile."
    ].join(" ")
  };
}
