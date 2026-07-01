import { companyState } from "./demo-data.js";
import { createTopThreePriorities, createNextActionBrief } from "./daily-priority-engine.js";
import { createMemorySystemSummary, getTimelineEvents, memoryEvents } from "./memory-system.js";
import {
  createFounderAgendaBrief,
  getDefaultFounderCommunicationsService
} from "./founder-communications-consumer.js";

const executiveMemory = {
  companyDecisions: [
    "Prometheus is the company; Prometheus IQ is the flagship product.",
    "Prometheus is an AI operating system for outside sales, not a gym application.",
    "Gym sales is the first production validation environment, not the market definition.",
    "Prometheus serves organizations where sales happen outside the office.",
    "Prometheus will not become a surveillance product, generic CRM clone, or single-feature route planner."
  ],
  productDecisions: [
    "Every product feature should help sell more, drive less, waste less time, learn what works, or make tomorrow's route smarter.",
    "Prometheus IQ should decide where to create leads before CRM systems record them.",
    "Route Intelligence plus verified field activity remains the core product advantage.",
    "The Active Pool should keep runtime recommendations focused on reviewed, current, walk-in-relevant records.",
    "Anthony's beta must stay isolated from Cruz's founder history."
  ],
  engineeringMilestones: [
    "Prometheus IQ established Route Intelligence, GPS verification, visit logging, rep/owner modes, import/export, and goal tracking.",
    "Cloudflare deployment and protection moved Prometheus from local-only app to controlled access.",
    "Prometheus Companion became a local Mac founder assistant with voice, memory, reasoning, and sync/install verification.",
    "Founder communications now consume the shared Integrations contract instead of local calendar/message placeholders.",
    "Research, Sales, Administration, Integrations, Data, CRM, and Infrastructure foundations are tracked as separate subsystems."
  ],
  betaFindings: [
    "Verified beta findings are still incomplete until Anthony produces real usage feedback.",
    "The beta should test route clarity, walk-in readiness, GPS verification, visit logging, feedback capture, and export/report usefulness.",
    "Companion must not affect Anthony's beta runtime or Dashboard-owned product behavior."
  ],
  investorConversations: [
    "No verified investor conversation records are present in Companion memory yet.",
    "Investor framing should stay truthful: Prometheus is outside-sales intelligence infrastructure, not a route planner or CRM clone.",
    "The strongest evidence for future investor conversations is external validation: beta usage, pilot proof, verified field outcomes, and executive willingness to approve."
  ]
};

function signal(key, fallback = {}) {
  return companyState.statusCards.find((card) => card.key === key) || fallback;
}

function sentenceList(items) {
  return items.map((item, index) => `${index + 1}. ${item}`).join(" ");
}

function recentEngineeringSummary() {
  const events = getTimelineEvents({ period: "week" })
    .filter((event) => {
      const tags = event.tags.join(" ").toLowerCase();
      const entities = event.entities.join(" ").toLowerCase();
      return tags.includes("companion") ||
        tags.includes("product") ||
        tags.includes("route-intelligence") ||
        entities.includes("prometheus companion") ||
        entities.includes("prometheus iq");
    })
    .slice(-4);

  if (!events.length) return "Engineering memory has no new verified event for this week.";
  return events.map((event) => `${event.title}: ${event.summary}`).join(" ");
}

export async function createFounderMorningBrief({
  communicationsService = getDefaultFounderCommunicationsService()
} = {}) {
  const agenda = await createFounderAgendaBrief({
    service: communicationsService,
    command: "founder morning brief"
  });
  const beta = signal("anthony", { value: "Ready", detail: "Anthony beta requires real usage feedback." });
  const website = signal("website", { value: "Live", detail: "PrometheusRouteIQ.com is live." });
  const social = signal("social", { value: "@prometheus.iq", detail: "Manual social tracking remains available." });
  const priorities = createTopThreePriorities();

  return {
    title: "Founder Morning Brief",
    body: [
      `Engineering: ${recentEngineeringSummary()}`,
      `Beta: ${beta.value}. ${beta.detail}`,
      "Research: Research foundation exists for Founder Intelligence Briefs; no live research feed is connected to Companion yet.",
      "Sales: Enterprise sales foundation exists. Use the horizontal outside-sales operating-system narrative, not gym-only positioning.",
      `Website: ${website.value}. ${website.detail}`,
      `Social Media: ${social.value}. ${social.detail}`,
      `Calendar: ${agenda.body}`,
      `Priorities: ${priorities.body}`,
      "Executive read: protect Anthony beta, preserve founder focus, and turn internal progress into external proof."
    ].join(" "),
    metadata: {
      executiveCommandCenter: true,
      sections: ["engineering", "beta", "research", "sales", "website", "social media", "calendar", "priorities"],
      calendarState: agenda.metadata?.integrationState || "Unknown"
    }
  };
}

export function createExecutiveDashboardSummary() {
  const next = createNextActionBrief();
  const memory = createMemorySystemSummary();
  return {
    title: "Executive Dashboard",
    body: [
      "Company: Prometheus is the AI operating system for outside sales; Prometheus IQ is the flagship product.",
      "Product: Route Intelligence and verified field activity are the durable advantage.",
      "Beta: Anthony validation remains the main proof gap; do not disturb the beta runtime.",
      "Sales: Keep leadership asks simple: controlled pilot, limited users, safeguards, weekly review, final report.",
      "Research: Foundation exists; next value is dated Founder Intelligence Briefs, not more architecture.",
      "Website/Social: Public presence should create credibility and curiosity without exposing proprietary mechanics.",
      `Memory: ${memory.body}`,
      `Decision: ${next.body}`
    ].join(" "),
    metadata: {
      executiveCommandCenter: true,
      summaryMode: "concise-founder-summary"
    }
  };
}

export function createDailyDecisionSupport() {
  return {
    title: "Daily Decision Support",
    body: [
      "Decision frame: rank work by external proof, revenue path, risk reduction, and founder leverage.",
      "Engineering: fix only defects that block Companion acceptance, beta validation, or reliable recovery.",
      "Product: prioritize Anthony beta evidence, route quality, visit logging, and proof that tomorrow's route gets smarter.",
      "Sales: prepare leadership follow-up only after the proof loop is clear enough to defend.",
      "Marketing: publish safe founder progress and field-sales lessons without showing internal screens, route scoring, customer data, or proprietary logic.",
      "Recommendation: product/beta validation first, sales follow-up second, marketing third, engineering only for verified blockers."
    ].join(" "),
    metadata: {
      executiveCommandCenter: true,
      decisionMode: "executive-prioritization"
    }
  };
}

export function createFounderMemoryRecall(command = "") {
  const normalized = String(command).toLowerCase();
  let key = "companyDecisions";
  let title = "Founder Memory";

  if (normalized.includes("product")) {
    key = "productDecisions";
    title = "Product Decision Memory";
  } else if (normalized.includes("engineering") || normalized.includes("milestone")) {
    key = "engineeringMilestones";
    title = "Engineering Milestone Memory";
  } else if (normalized.includes("beta") || normalized.includes("anthony")) {
    key = "betaFindings";
    title = "Beta Finding Memory";
  } else if (normalized.includes("investor")) {
    key = "investorConversations";
    title = "Investor Conversation Memory";
  } else if (normalized.includes("company") || normalized.includes("decision")) {
    key = "companyDecisions";
    title = "Company Decision Memory";
  }

  return {
    title,
    body: [
      sentenceList(executiveMemory[key]),
      `Verified memory events available: ${memoryEvents.length}.`,
      "Truth rule: Companion only states investor, beta, and customer facts that have been recorded."
    ].join(" "),
    metadata: {
      executiveCommandCenter: true,
      memoryCategory: key
    }
  };
}

export function createExecutiveStrategyMeeting() {
  return {
    title: "Executive Strategy Meeting",
    body: [
      "Agenda: decide the single highest-leverage proof loop, identify the evidence, name the risk, then choose the next action.",
      "Current strategic read: Prometheus has enough internal build progress. The operating constraint is external validation.",
      "Evidence needed: Anthony beta feedback, verified visits, route-quality notes, leadership response, and clean daily memory.",
      "Risk: polishing systems can feel productive while delaying market proof.",
      "Decision: keep Companion as Cruz's executive operating system and keep Prometheus IQ beta behavior untouched."
    ].join(" "),
    metadata: {
      executiveCommandCenter: true,
      conversationMode: "executive-strategy-meeting"
    }
  };
}
