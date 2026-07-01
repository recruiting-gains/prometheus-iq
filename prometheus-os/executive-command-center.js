import { companyState } from "./demo-data.js";
import { createTopThreePriorities, createNextActionBrief } from "./daily-priority-engine.js";
import { createMemorySystemSummary, getTimelineEvents, memoryEvents } from "./memory-system.js";
import {
  createFounderAgendaBrief,
  getDefaultFounderCommunicationsService
} from "./founder-communications-consumer.js";

const readOnlySources = Object.freeze({
  company: ["COMPANY_IDENTITY.md", "docs/product-vision.md"],
  research: ["research/README.md", "research/templates/founder-intelligence-brief.md"],
  sales: ["sales/README.md", "sales/enterprise-sales-methodology.md"],
  website: ["docs/public-site-cloudflare-readiness.md", "docs/3d-website-production-route.md"],
  socialMedia: [
    "social-media/founder-marketing-operating-system/README.md",
    "social-media/founder-marketing-operating-system/founder-marketing-operating-system.v1.json"
  ]
});

const sourceSummaries = Object.freeze({
  company: [
    "Prometheus exists to make outside sales intelligent, directed, accountable, and compounding.",
    "Prometheus is the company; Prometheus IQ is the flagship product.",
    "The customer is the outside sales organization, not the gym vertical.",
    "The product promise is better field direction: sell more, drive less, waste less time, learn what works, and make tomorrow's route smarter."
  ],
  research: [
    "Research is Prometheus' strategic intelligence division.",
    "Research produces verified intelligence for founders, engineering, product strategy, sales, marketing, and future AI decision making.",
    "Research outputs are advisory until an approved subsystem handoff accepts implementation.",
    "Founder Intelligence Briefs should separate verified facts, hypotheses, implications, risks, and handoff recommendations."
  ],
  sales: [
    "Sales owns reusable go-to-market strategy, messaging, discovery, qualification, demos, pilots, onboarding, expansion, renewal, and customer-facing sales documentation.",
    "The sales thesis: Prometheus is the field-sales operating layer before and during CRM activity.",
    "Discovery should confirm a real field execution problem before demoing.",
    "Controlled pilots need written scope, users, success metrics, privacy boundaries, review cadence, and decision criteria."
  ],
  website: [
    "The public website builds independently from the private Prometheus IQ app.",
    "The website should communicate outcomes and pilot credibility without exposing route scoring, private customer data, GPS records, source code, prompts, or secrets.",
    "The Prometheus visual standard is premium, cinematic, dark, intelligent, field-sales focused, and executive-ready.",
    "Public website changes remain Website-owned; Companion can summarize status only."
  ],
  socialMedia: [
    "The Founder Marketing Operating System is manual-operations ready with no production integrations, no live Meta APIs, and no live posting.",
    "Content pillars are Field Reality, Product Intelligence, Founder Build In Public, Enterprise Trust, and Outside Sales Education.",
    "Publishing remains manual until approved integrations exist.",
    "Social Media must not expose Anthony beta details, private dashboards, proprietary route logic, customer data, or live provider claims."
  ]
});

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

function sourceMetadata(area) {
  return {
    executiveCommandCenter: true,
    readOnlySources: readOnlySources[area] || [],
    sourceMode: "read-only-summary"
  };
}

export function createCompanyStatusSummary() {
  const next = createNextActionBrief();
  return {
    title: "Company Status",
    body: [
      `Identity: ${sourceSummaries.company.join(" ")}`,
      "Operating stage: founder-led validation moving from internal build progress toward external proof.",
      "Current constraint: credible beta and pilot evidence matter more than additional surface polish.",
      "Company rule: do not narrow Prometheus into a gym app, route planner, CRM clone, or surveillance product.",
      `Founder decision: ${next.body}`
    ].join(" "),
    metadata: {
      ...sourceMetadata("company"),
      summaryArea: "company"
    }
  };
}

export function createEngineeringStatusSummary() {
  return {
    title: "Engineering Status",
    body: [
      `Companion: Executive operating-system layer, memory, reasoning, voice verification, and sync/install drift checks are active.`,
      `Prometheus IQ: ${signal("route", { value: "Route Intelligence", detail: "Route logic remains product-owned." }).detail}`,
      "Boundary: this Companion summary does not modify Dashboard, Data, Infrastructure, CRM, or Anthony beta behavior.",
      `Recent engineering memory: ${recentEngineeringSummary()}`,
      "Engineering recommendation: fix verified blockers only; avoid new feature work that does not improve beta proof or founder operating leverage."
    ].join(" "),
    metadata: {
      executiveCommandCenter: true,
      summaryArea: "engineering"
    }
  };
}

export function createResearchSummary() {
  return {
    title: "Research Summary",
    body: [
      sourceSummaries.research.join(" "),
      "Current read: Research is ready as a structured intelligence foundation, but Companion does not yet consume live dated research briefs.",
      "Founder action: request a dated Founder Intelligence Brief when strategic uncertainty needs external evidence.",
      "Boundary: no production research integration or automated external-source ingestion was added."
    ].join(" "),
    metadata: {
      ...sourceMetadata("research"),
      summaryArea: "research"
    }
  };
}

export function createSalesSummary() {
  return {
    title: "Sales Summary",
    body: [
      sourceSummaries.sales.join(" "),
      "Current founder read: keep the sales motion pilot-first and evidence-led.",
      "Best next sales move: clarify the buyer problem, define a value hypothesis, then ask for a controlled pilot only when success criteria are clear.",
      "Boundary: Companion summarizes Sales sources only; CRM workflows and customer records remain out of scope."
    ].join(" "),
    metadata: {
      ...sourceMetadata("sales"),
      summaryArea: "sales"
    }
  };
}

export function createWebsiteSummary() {
  const website = signal("website", { value: "Live", detail: "PrometheusRouteIQ.com is live." });
  return {
    title: "Website Summary",
    body: [
      `${website.value}. ${website.detail}`,
      sourceSummaries.website.join(" "),
      "Founder action: use the website for credibility and pilot interest, not to reveal internal mechanics.",
      "Boundary: no Website files or deployment systems are modified by Companion."
    ].join(" "),
    metadata: {
      ...sourceMetadata("website"),
      summaryArea: "website"
    }
  };
}

export function createSocialMediaSummary() {
  const social = signal("social", { value: "@prometheus.iq", detail: "Manual social tracking remains available." });
  return {
    title: "Social Media Summary",
    body: [
      `${social.value}. ${social.detail}`,
      sourceSummaries.socialMedia.join(" "),
      "Founder action: publish field reality, product intelligence, and enterprise-trust lessons manually.",
      "Boundary: no OAuth, scraping, browser automation, automated posting, or live Meta metrics are claimed."
    ].join(" "),
    metadata: {
      ...sourceMetadata("socialMedia"),
      summaryArea: "social_media"
    }
  };
}

export function createBetaSummary() {
  const beta = signal("anthony", { value: "Ready", detail: "Anthony beta requires real usage feedback." });
  return {
    title: "Beta Summary",
    body: [
      `${beta.value}. ${beta.detail}`,
      executiveMemory.betaFindings.join(" "),
      "Founder action: collect route clarity, walk-in readiness, GPS verification, visit logging, feedback, and export/report usefulness.",
      "Boundary: Companion must not modify Anthony beta, Dashboard behavior, production route data, or beta access controls."
    ].join(" "),
    metadata: {
      executiveCommandCenter: true,
      summaryArea: "beta"
    }
  };
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
  const research = createResearchSummary();
  const sales = createSalesSummary();

  return {
    title: "Founder Morning Brief",
    body: [
      `Engineering: ${recentEngineeringSummary()}`,
      `Beta: ${beta.value}. ${beta.detail}`,
      `Research: ${research.body}`,
      `Sales: ${sales.body}`,
      `Website: ${website.value}. ${website.detail}`,
      `Social Media: ${social.value}. ${social.detail}`,
      `Calendar: ${agenda.body}`,
      `Priorities: ${priorities.body}`,
      "Executive read: protect Anthony beta, preserve founder focus, and turn internal progress into external proof."
    ].join(" "),
    metadata: {
      executiveCommandCenter: true,
      sections: ["engineering", "beta", "research", "sales", "website", "social media", "calendar", "priorities"],
      calendarState: agenda.metadata?.integrationState || "Unknown",
      readOnlySources: [
        ...readOnlySources.research,
        ...readOnlySources.sales,
        ...readOnlySources.website,
        ...readOnlySources.socialMedia
      ]
    }
  };
}

export function createExecutiveDashboardSummary() {
  const next = createNextActionBrief();
  const memory = createMemorySystemSummary();
  return {
    title: "Executive Dashboard",
    body: [
      `Company: ${sourceSummaries.company.join(" ")}`,
      "Product: Route Intelligence and verified field activity are the durable advantage.",
      "Beta: Anthony validation remains the main proof gap; do not disturb the beta runtime.",
      `Research: ${sourceSummaries.research[0]} ${sourceSummaries.research[3]}`,
      `Sales: ${sourceSummaries.sales[0]} ${sourceSummaries.sales[3]}`,
      `Website: ${sourceSummaries.website[1]}`,
      `Social Media: ${sourceSummaries.socialMedia[0]} ${sourceSummaries.socialMedia[1]}`,
      `Memory: ${memory.body}`,
      `Decision: ${next.body}`
    ].join(" "),
    metadata: {
      executiveCommandCenter: true,
      summaryMode: "concise-founder-summary",
      readOnlySources: Object.values(readOnlySources).flat()
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
      "Research: use Founder Intelligence Briefs when a decision needs external evidence, not when it only needs execution.",
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
