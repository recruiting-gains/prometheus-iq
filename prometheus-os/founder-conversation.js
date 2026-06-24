import { createTopThreePriorities, createNextActionBrief } from "./daily-priority-engine.js";

const followUpPatterns = [
  /^why\b/,
  /^why that\b/,
  /^explain\b/,
  /^how\b/,
  /^what do you mean\b/,
  /^tell me more\b/,
  /^break that down\b/
];

export function isFounderFollowUp(command = "") {
  const normalized = String(command || "").toLowerCase().trim();
  return followUpPatterns.some((pattern) => pattern.test(normalized));
}

export function createFounderFollowUpResponse(command = "", lastEntry = null) {
  if (!lastEntry?.response?.body) {
    return {
      title: "Follow-Up",
      body: "I need one previous answer to anchor that follow-up. Ask me what to do next, where we are at, or what matters right now, and I will explain the reasoning after that."
    };
  }

  const previousTitle = lastEntry.response.title || "the last recommendation";
  return {
    title: `Why ${previousTitle} matters`,
    body: `Because the last answer was tied to company leverage, not activity for activity's sake. The important question is: does this move Prometheus closer to pilot proof, customer trust, revenue, or risk reduction? Based on the last recommendation, the reason is this: ${lastEntry.response.body} The founder move is to turn that into one measurable next step instead of opening a new build thread.`
  };
}

export function createFounderRundown(command = "") {
  const normalized = String(command || "").toLowerCase();

  if (normalized.includes("what did we finish") || normalized.includes("what changed") || normalized.includes("finish")) {
    return {
      title: "What We Finished",
      body: "Prometheus has moved forward across product, website, executive readiness, GitHub backup discipline, and Prometheus Companion. The Companion is now becoming a private Chief of Staff instead of only a visual command center."
    };
  }

  if (normalized.includes("what should i tell chris") || normalized.includes("tell chris")) {
    return {
      title: "What To Tell Chris",
      body: "Tell Chris the ask is controlled and low-risk: three approved users, 14 days, GPS-verified activity, weekly review, and a final report. Do not lead with proprietary technology. Lead with visibility, accountability, and measurable LSM field performance."
    };
  }

  if (
    normalized.includes("whats the move") ||
    normalized.includes("what is the move") ||
    normalized.includes("what matters right now") ||
    normalized.includes("where are we at")
  ) {
    const next = createNextActionBrief();
    return {
      title: "Founder Move",
      body: `${next.body} The broader status: product is real, website is live, pilot materials are prepared, and the next company proof has to come from controlled beta usage.`
    };
  }

  if (normalized.includes("rundown")) {
    const priorities = createTopThreePriorities();
    return {
      title: "Prometheus Rundown",
      body: `Prometheus is in validation mode. ${priorities.body}`
    };
  }

  return {
    title: "Founder Conversation",
    body: "The direct answer: stay in validation mode. Protect the beta, capture feedback, keep leadership communication simple, and avoid new features unless the pilot proves they are necessary."
  };
}

export function isFounderConversationCommand(command = "") {
  const normalized = String(command || "").toLowerCase();
  return [
    "whats the move",
    "what is the move",
    "where are we at",
    "what matters right now",
    "give me the rundown",
    "rundown",
    "what did we finish",
    "what should i tell chris"
  ].some((phrase) => normalized.includes(phrase));
}
