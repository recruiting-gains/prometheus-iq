import { createTopThreePriorities, createNextActionBrief } from "./daily-priority-engine.js";
import { companyState } from "./demo-data.js";

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
      body: `The current operating reason is simple: Route IQ is operational, and the company is in ${companyState.currentPhase.join(", ").toLowerCase()}. The next action should move today's customer mission or close a verified readiness gap.`
    };
  }

  const previousTitle = lastEntry.response.title || "the last recommendation";
  return {
    title: `Why ${previousTitle} matters`,
    body: `Because the last answer was tied to operating leverage, not activity for activity's sake. The important question is whether it moves a customer decision, closes a verified readiness gap, protects Route IQ operations, or reduces enterprise risk. Based on the last recommendation: ${lastEntry.response.body} Turn that into one measurable next step.`
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

  if (normalized.includes("what should i tell the customer") || normalized.includes("customer message")) {
    return {
      title: "Customer Message",
      body: "Lead with the current operating outcome: Route IQ makes outside sales more directed, accountable, and learnable. Keep the next step specific, preserve proprietary mechanics, and record the customer decision in CRM."
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
      body: `${next.body} The broader status: Route IQ is operational and Patent Pending; Gaia is paused; Athena is architecture only; and the company is executing readiness, onboarding, hardening, and continuous improvement.`
    };
  }

  if (normalized.includes("rundown")) {
    const priorities = createTopThreePriorities();
    return {
      title: "Prometheus Rundown",
      body: `Prometheus is in ${companyState.currentPhase.join(", ").toLowerCase()}. ${priorities.body}`
    };
  }

  return {
    title: "Founder Conversation",
    body: `The direct answer: ${companyState.chiefOfStaff.recommendedNextAction}`
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
    "what should i tell the customer"
  ].some((phrase) => normalized.includes(phrase));
}
