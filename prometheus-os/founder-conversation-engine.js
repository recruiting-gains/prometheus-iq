import { normalizeText } from "./memory-ranking.js";
import { companyState } from "./demo-data.js";

const stopCommands = new Set([
  "stop",
  "stop talking",
  "quiet",
  "pause",
  "actually stop",
  "stop please",
  "pause please"
]);

function response(title, body, metadata = {}) {
  return {
    title,
    body,
    permission: "Level 0 - Read Only",
    tone: "founder-executive",
    metadata: {
      founderAssistant: true,
      founderConversationEngine: true,
      routeSelected: "founder_conversation_engine",
      cardFallbackUsed: false,
      showCard: false,
      ...metadata
    }
  };
}

function isGreeting(normalized = "") {
  return [
    "hello",
    "hi",
    "hey",
    "good morning",
    "morning",
    "good morning companion",
    "good morning prometheus"
  ].includes(normalized);
}

function isExecutiveQuestion(normalized = "") {
  return [
    "how are we doing",
    "how are we looking",
    "where do we stand",
    "whats slowing prometheus down",
    "what s slowing prometheus down",
    "what is slowing prometheus down",
    "whats slowing us down",
    "what s slowing us down",
    "what is slowing us down",
    "what should i work on",
    "what should i work on first",
    "what should i build",
    "what should i do next",
    "what should i do",
    "what changed today",
    "continue"
  ].includes(normalized) ||
    /\bwhat should i work on first\b/.test(normalized) ||
    /\bwhat should i (work on|build|do)\b/.test(normalized) ||
    /\bwhat\s*s slowing\b/.test(normalized) ||
    /\bwhats slowing\b/.test(normalized) ||
    /\bwhat changed today\b/.test(normalized) ||
    /\bhow are we doing\b/.test(normalized);
}

function timelineSignal(founderTimeline) {
  if (!founderTimeline?.ok) return "";
  const verification = founderTimeline.verification?.result || "";
  const latestCommit = founderTimeline.commits?.[0];
  const companion = founderTimeline.checkpoints?.find((item) => item.area === "Companion")?.status;
  return [
    verification ? `Companion verification is ${verification}` : "",
    latestCommit ? `latest commit is ${latestCommit.shortHash}` : "",
    companion ? `Companion signal: ${companion}` : ""
  ].filter(Boolean).join("; ");
}

function recentThread(history = [], turns = []) {
  const combined = [
    ...history.map((turn) => ({
      input: turn.input || "",
      title: turn.response?.title || "",
      body: turn.response?.body || ""
    })),
    ...turns
  ];
  return combined.filter((turn) => turn.input || turn.body).slice(0, 5);
}

export function isFounderStopCommand(value = "") {
  return stopCommands.has(normalizeText(value));
}

export class FounderConversationEngine {
  constructor({ founderTimeline = null } = {}) {
    this.founderTimeline = founderTimeline;
    this.turns = [];
    this.lastExecutiveRead = "";
  }

  setFounderTimeline(timeline) {
    this.founderTimeline = timeline || null;
  }

  remember(input, result) {
    this.turns.unshift({
      input,
      title: result?.title || "",
      body: result?.body || "",
      intent: result?.metadata?.intent || "",
      timestamp: new Date().toISOString()
    });
    this.turns = this.turns.slice(0, 40);
  }

  shouldAnswer(command = "") {
    const normalized = normalizeText(command);
    if (!normalized) return false;
    if (isFounderStopCommand(normalized)) return false;
    return isGreeting(normalized) || isExecutiveQuestion(normalized);
  }

  answer(command = "", { history = [] } = {}) {
    const normalized = normalizeText(command);
    const thread = recentThread(history, this.turns);
    const timeline = timelineSignal(this.founderTimeline);

    if (isGreeting(normalized)) {
      const morning = normalized.includes("morning");
      const body = morning
        ? "Good morning. Everything is ready. Route IQ is operational, and today's work should move deployment readiness or customer onboarding forward."
        : "I’m here. What are we working on?";
      this.lastExecutiveRead = body;
      return response(morning ? "Good Morning" : "I'm Here", body, {
        intent: morning ? "morning_greeting" : "natural_greeting",
        spokenText: body
      });
    }

    if (normalized === "continue") {
      const last = thread[0];
      const body = last?.body
        ? `Continuing from that thread: ${last.body} My recommendation stays the same. Complete the next governed action in the current Founder workflow.`
        : `Continuing from the current operating state: ${companyState.chiefOfStaff.recommendedNextAction}`;
      this.lastExecutiveRead = body;
      return response("Continuing", body, {
        intent: "conversation_continue",
        spokenText: body
      });
    }

    if (/\bhow are we doing\b/.test(normalized) || normalized.includes("how are we looking") || normalized.includes("where do we stand")) {
      const body = [
        "We are operating, not proving the concept anymore.",
        "Route IQ is operational, Patent Pending, and the primary product. Gaia is paused. Athena remains architecture only.",
        `The company phase is ${companyState.currentPhase.join(", ").toLowerCase()}.`,
        timeline ? `Latest operating signal: ${timeline}.` : "",
        "Recommendation: run today's customer mission and close the next verified readiness or hardening item without opening an ungoverned expansion thread."
      ].filter(Boolean).join(" ");
      this.lastExecutiveRead = body;
      return response("Prometheus Status", body, {
        intent: "company_rundown",
        entities: ["Prometheus", "Route IQ", "Gaia", "Athena", "Overwatch"],
        spokenText: body
      });
    }

    if (/\bwhat\s*s slowing\b/.test(normalized) || /\bwhats slowing\b/.test(normalized) || normalized.includes("what is slowing")) {
      const body = [
        "The likely slowdown is execution discipline across readiness and onboarding, not product identity.",
        "Route IQ is operational. The remaining friction is authenticated production verification, account-owner security controls, complete customer handoff evidence, and keeping current state synchronized across workspaces.",
        "Next move: close one readiness blocker, then execute the highest-value customer action in today's mission."
      ].join(" ");
      this.lastExecutiveRead = body;
      return response("Prometheus Bottleneck", body, {
        intent: "risk",
        entities: ["Route IQ", "Customer Onboarding", "Enterprise Hardening", "Overwatch"],
        spokenText: body
      });
    }

    if (normalized.includes("what should i work on") || normalized.includes("what should i build") || normalized.includes("what should i do")) {
      const body = [
        "Start with today's Founder mission.",
        "Select the active workspace, set the mission, review the Research dossier, and call the highest-value prospects first. Update the candidate stage after every call.",
        "After the customer block, close the next deployment-readiness or enterprise-hardening action already recorded by Overwatch."
      ].join(" ");
      this.lastExecutiveRead = body;
      return response("First Priority", body, {
        intent: "priority",
        entities: ["Founder Workflow", "Customer Onboarding", "Overwatch", "Route IQ"],
        spokenText: body
      });
    }

    if (normalized.includes("what changed today")) {
      const body = timeline
        ? `Today’s operating signal: ${timeline}. Route IQ remains operational and the current work stays inside deployment readiness, customer onboarding, enterprise hardening, and continuous operational improvement.`
        : "The current governed state is stable: Route IQ is operational and Patent Pending, Gaia is paused, Athena is architecture only, and the next value comes from readiness and customer onboarding.";
      this.lastExecutiveRead = body;
      return response("Today’s Change", body, {
        intent: "today_recap",
        spokenText: body
      });
    }

    const body = [
      "My best judgment: stay with the operating thread we are already in.",
      "Route IQ is operational, so the decision standard is operational leverage.",
      "Choose the action that advances today's customer mission, closes verified readiness work, or strengthens enterprise operations."
    ].join(" ");
    this.lastExecutiveRead = body;
    return response("Founder Judgment", body, {
      intent: "executive_judgment",
      spokenText: body
    });
  }
}
