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
        "The reason it matters is company leverage: the best work right now should move customer onboarding, close verified readiness, reduce enterprise risk, or make Prometheus easier to operate.",
        decision.body,
        "Prometheus compounds when the next action produces a customer decision or a verified operating improvement."
      ].join(" ")
    };
  }

  return {
    title: "Context follow-up",
    body: [
      `I am connecting that follow-up to ${lastAnswerSummary(lastEntry)}`,
      "Ask me about Route IQ, Gaia, Athena, the current company phase, the Founder workflow, Overwatch, the website, GitHub, Cloudflare, CRM, or social media and I will pull the current profile."
    ].join(" ")
  };
}
