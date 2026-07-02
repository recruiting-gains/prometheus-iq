import { normalizeText } from "./memory-ranking.js";

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
        ? "Good morning. Everything is ready. I would keep today focused on proof: validate the experience, tighten the voice loop, and avoid starting another build thread unless it removes friction for founder use."
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
        ? `Continuing from that thread: ${last.body} My recommendation stays the same. Pick the move that creates the cleanest proof, then stop before it turns into another feature build.`
        : "Continuing from the operating state: validate first, build second. I would use the next block to prove the experience is working before adding more surface area.";
      this.lastExecutiveRead = body;
      return response("Continuing", body, {
        intent: "conversation_continue",
        spokenText: body
      });
    }

    if (/\bhow are we doing\b/.test(normalized) || normalized.includes("how are we looking") || normalized.includes("where do we stand")) {
      const body = [
        "We’re in a strong build position, but not a strong proof position yet.",
        "The product, Companion, website, and social layer are moving. The constraint is still evidence: beta behavior, route confidence, and buyer proof.",
        timeline ? `Latest operating signal: ${timeline}.` : "",
        "Recommendation: do not chase another feature today. Validate the founder and field experience first."
      ].filter(Boolean).join(" ");
      this.lastExecutiveRead = body;
      return response("Prometheus Status", body, {
        intent: "company_rundown",
        entities: ["Prometheus", "Companion", "Beta", "Route Intelligence"],
        spokenText: body
      });
    }

    if (/\bwhat\s*s slowing\b/.test(normalized) || /\bwhats slowing\b/.test(normalized) || normalized.includes("what is slowing")) {
      const body = [
        "The slowdown is proof, not capability.",
        "Prometheus has enough built to test. What can still slow us down is beta validation, weak field evidence, unclear feedback, Companion voice friction, Mobile verification risk, route-quality confidence, and buyer proof.",
        "Next move: fix the founder conversation loop first, then validate the field workflow. Building more before that creates motion without leverage."
      ].join(" ");
      this.lastExecutiveRead = body;
      return response("Prometheus Bottleneck", body, {
        intent: "risk",
        entities: ["Beta", "Companion", "Mobile", "Route Intelligence"],
        spokenText: body
      });
    }

    if (normalized.includes("what should i work on") || normalized.includes("what should i build") || normalized.includes("what should i do")) {
      const body = [
        "Work on the first thing that makes Prometheus feel reliable in real use.",
        "Today, I would start with Companion conversation quality, then validate Mobile and route evidence. I would not start with another feature unless it directly removes friction from that path.",
        "Recommendation: make the founder experience feel alive, then prove the field workflow is stable."
      ].join(" ");
      this.lastExecutiveRead = body;
      return response("First Priority", body, {
        intent: "priority",
        entities: ["Companion", "Mobile", "Route Intelligence"],
        spokenText: body
      });
    }

    if (normalized.includes("what changed today")) {
      const body = timeline
        ? `Today’s operating signal: ${timeline}. My read is that Companion is the active leverage point, because it determines whether you can run the company through conversation instead of dashboards.`
        : "Today’s useful read is Companion and validation. I do not need perfect data to say this: the highest-value move is making the founder operating loop reliable, then validating the field workflow.";
      this.lastExecutiveRead = body;
      return response("Today’s Change", body, {
        intent: "today_recap",
        spokenText: body
      });
    }

    const body = [
      "My best judgment: stay with the operating thread we are already in.",
      "Prometheus needs proof more than polish right now.",
      "Choose the action that improves founder control, beta evidence, route confidence, or buyer clarity."
    ].join(" ");
    this.lastExecutiveRead = body;
    return response("Founder Judgment", body, {
      intent: "executive_judgment",
      spokenText: body
    });
  }
}
