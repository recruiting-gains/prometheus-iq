import { companyState } from "./demo-data.js";
import { createTopThreePriorities, createNextActionBrief } from "./daily-priority-engine.js";
import { createMemorySystemSummary, getTimelineEvents, memoryEvents } from "./memory-system.js";
import {
  createFounderAgendaBrief,
  getDefaultFounderCommunicationsService
} from "./founder-communications-consumer.js";
import {
  createFounderInstagramAnalyticsBrief,
  getDefaultFounderSocialAnalyticsService
} from "./founder-instagram-analytics-consumer.js";

const readOnlySources = Object.freeze({
  company: [
    "README.md",
    "PRODUCT_VISION.md",
    "overwatch/reports/prometheus-architectural-evolution-report-v1.md"
  ],
  research: ["research/README.md", "research/architecture.md"],
  sales: ["sales/README.md", "sales/enterprise-sales-methodology.md"],
  website: ["website/README.md", "README.md"],
  crm: ["crm/README.md", "crm/enterprise-lifecycle-architecture.md"],
  socialMedia: [
    "social-media/contracts/social-media-contract.js",
    "social-media/social-media-analytics-service.js"
  ]
});

const sourceSummaries = Object.freeze({
  company: [
    companyState.mission,
    companyState.platformDefinition,
    "Route IQ is operational, Patent Pending, and the primary product.",
    "Gaia is paused. Athena is architecture only."
  ],
  research: [
    "Research remains a read-only strategic intelligence source for Founder decisions.",
    "Gaia's architecture foundation is preserved, but Gaia is paused and does not own current execution.",
    "Research outputs remain advisory until a governed handoff accepts implementation."
  ],
  sales: [
    "Sales supports current customer onboarding and enterprise operating conversations.",
    "The current commercial motion should use Route IQ's operational state and the governed customer record.",
    "Discovery, qualification, next-step control, and evidence-based handoff remain the operating disciplines."
  ],
  website: [
    "PrometheusRouteIQ.com is live, remains Website-owned, and supports current product positioning and customer onboarding.",
    "Companion summarizes Website state without modifying the public surface."
  ],
  crm: [
    "CRM preserves contacts, leads, candidates, stages, follow-ups, and handoff evidence.",
    "The Founder updates the candidate stage after every call and hands off to JR only when evidence supports it.",
    "Companion summarizes CRM state and does not create a parallel record system."
  ],
  socialMedia: [
    "Social Media provides the current Instagram performance and content readout.",
    "Companion uses that governed readout to brief the Founder without taking over publishing or account control."
  ]
});

const executiveMemory = {
  companyDecisions: [
    "Prometheus is the AI operating system for outside sales.",
    "The company mission is to make outside sales intelligent, directed, accountable, and compounding.",
    "Route IQ is the primary operational product.",
    "Gaia is paused and Athena is architecture only.",
    "Overwatch governs trusted platform state, subsystem boundaries, and verified checkpoints."
  ],
  productDecisions: [
    "Route IQ is operational and Patent Pending.",
    "Route IQ remains the primary engineering and company focus.",
    "Material Route IQ invention changes must be documented in the patent workspace.",
    "The Active Pool uses approved, current, workspace-relevant records.",
    "No Gaia or Athena expansion is authorized by the current company phase."
  ],
  engineeringMilestones: [
    "Route IQ reached operational status.",
    "The Route IQ provisional patent application was filed and Patent Pending status is current.",
    "Prometheus established governed workspace isolation, CRM handoffs, Founder operations, and Overwatch checkpoints.",
    "Prometheus Companion was reactivated as the Founder's private executive operating system.",
    "Current engineering work is deployment readiness, customer onboarding support, enterprise hardening, and continuous operational improvement."
  ],
  operationalState: [
    "Company phase: deployment readiness, customer onboarding, enterprise hardening, and continuous operational improvement.",
    "Route IQ is operational, Patent Pending, and the primary company product.",
    "Gaia is paused.",
    "Athena is architecture only.",
    "Remaining blockers must come from current Overwatch evidence, not historical assumptions."
  ],
  investorConversations: [
    "No verified current investor conversation record is present in Companion memory.",
    "Current external framing should be truthful: Route IQ is an operational, Patent Pending outside-sales product inside the Prometheus operating platform.",
    "Do not claim customer, revenue, or investor outcomes that are not recorded in governed evidence."
  ]
};

const historicalCompanyPhasePatterns = Object.freeze([
  /\bconcept[-\s]?testing\b/i,
  /\bpilot\b/i,
  /\bbeta\b/i,
  /\bvalidation\b/i
]);

function requestsHistoricalCompanyPhase(command = "") {
  const normalized = String(command).toLowerCase();
  return /\b(historical|history)\b/.test(normalized) ||
    /\b(previous|prior|past|former|old)\s+(company\s+)?phase\b/.test(normalized) ||
    /\bwhat\s+(was|were)\s+the\s+(previous|prior|past|former|old)\s+(company\s+)?phase\b/.test(normalized);
}

function operatingStateMemoryFor(command = "") {
  if (requestsHistoricalCompanyPhase(command)) {
    return executiveMemory.operationalState;
  }

  return executiveMemory.operationalState.filter((item) =>
    !historicalCompanyPhasePatterns.some((pattern) => pattern.test(item))
  );
}

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
        tags.includes("route-iq") ||
        tags.includes("operations") ||
        entities.includes("prometheus companion") ||
        entities.includes("route iq");
    })
    .slice(-4);

  if (!events.length) {
    return "Route IQ is operational and Companion is reactivated. Use Overwatch for the latest verified checkpoint.";
  }
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
      sourceSummaries.company.join(" "),
      `The current company phase is ${companyState.currentPhase.join(", ").toLowerCase()}.`,
      "The operating constraint is disciplined execution across readiness, onboarding, hardening, and verified improvement.",
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
      "Route IQ is operational, Patent Pending, and the primary engineering focus.",
      "Gaia is paused. Athena is architecture only.",
      "Companion is operating as the Founder's private briefing, memory, voice, and decision layer.",
      `Overwatch: ${companyState.overwatch.detail}`,
      `Recent engineering memory: ${recentEngineeringSummary()}`,
      "Recommendation: fix current verified blockers, protect subsystem ownership, and avoid ungoverned product expansion."
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
      "Use Research when a current decision needs outside evidence, and keep the result separate from implementation authority."
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
      "Founder action: run the active workspace mission, call the highest-value prospects first, update every stage, and preserve the next step in CRM."
    ].join(" "),
    metadata: {
      ...sourceMetadata("sales"),
      summaryArea: "sales"
    }
  };
}

export function createWebsiteSummary() {
  const website = signal("website", { value: "Operational", detail: "The public Prometheus presence supports customer onboarding." });
  return {
    title: "Website Summary",
    body: [
      `${website.value}. ${website.detail}`,
      sourceSummaries.website.join(" "),
      "Founder action: use the site for current product credibility and conversion without exposing protected mechanics or customer data."
    ].join(" "),
    metadata: {
      ...sourceMetadata("website"),
      summaryArea: "website"
    }
  };
}

export function createCrmSummary() {
  return {
    title: "CRM Summary",
    body: [
      sourceSummaries.crm.join(" "),
      "Founder action: preserve every call outcome, readiness signal, follow-up, and approved handoff."
    ].join(" "),
    metadata: {
      ...sourceMetadata("crm"),
      summaryArea: "crm"
    }
  };
}

export function createSocialMediaSummary() {
  return {
    title: "Social Media Summary",
    body: [
      sourceSummaries.socialMedia.join(" "),
      "Founder action: use current performance evidence for the next content decision and keep publishing manually controlled."
    ].join(" "),
    metadata: {
      ...sourceMetadata("socialMedia"),
      summaryArea: "social_media"
    }
  };
}

// Retained as a compatibility export for older callers; it now reports current operations.
export function createBetaSummary() {
  return {
    title: "Current Operations Summary",
    body: executiveMemory.operationalState.join(" "),
    metadata: {
      executiveCommandCenter: true,
      summaryArea: "current_operations"
    }
  };
}

export async function createFounderMorningBrief({
  communicationsService = getDefaultFounderCommunicationsService(),
  socialMediaAnalyticsService = getDefaultFounderSocialAnalyticsService()
} = {}) {
  const agenda = await createFounderAgendaBrief({
    service: communicationsService,
    command: "founder morning brief"
  });
  const priorities = createTopThreePriorities();
  const research = createResearchSummary();
  const sales = createSalesSummary();
  const website = createWebsiteSummary();
  const crm = createCrmSummary();
  const instagram = await createFounderInstagramAnalyticsBrief({ service: socialMediaAnalyticsService });

  return {
    title: "Founder Morning Brief",
    body: [
      "Here is the Founder read.",
      `Company: Route IQ is operational and Patent Pending. Gaia is paused. Athena is architecture only.`,
      `Phase: ${companyState.currentPhase.join(", ")}.`,
      `Engineering: ${recentEngineeringSummary()}`,
      `Instagram: ${instagram.body}`,
      `Research: ${research.body}`,
      `Sales: ${sales.body}`,
      `Website: ${website.body}`,
      `CRM: ${crm.body}`,
      `Calendar: ${agenda.body}`,
      `Daily Priorities: ${priorities.body}`,
      `Recommendation: ${companyState.chiefOfStaff.recommendedNextAction}`
    ].join(" "),
    metadata: {
      executiveCommandCenter: true,
      sections: ["company", "phase", "engineering", "instagram", "research", "sales", "website", "crm", "calendar", "priorities"],
      calendarState: agenda.metadata?.integrationState || "Unknown",
      instagramState: instagram.metadata.providerState,
      sourceSubsystems: [
        "Overwatch",
        "Prometheus Social Media",
        "Prometheus Research",
        "Prometheus Sales",
        "Prometheus Website",
        "Prometheus CRM",
        "Prometheus Integrations",
        "Prometheus Companion"
      ],
      readOnlySources: Object.values(readOnlySources).flat()
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
      `Phase: ${companyState.currentPhase.join(", ")}.`,
      "Operations: execute the current Founder workflow and preserve customer evidence in CRM.",
      "Research: use outside evidence only when a decision requires it.",
      "Website and Social Media: consume their current read-only outputs.",
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
      "Use this frame: customer movement first, verified readiness second, enterprise risk reduction third, and operational improvement throughout.",
      "Engineering should fix only current verified blockers or improve an observed Route IQ workflow.",
      "Sales should execute the active workspace mission and keep CRM stages and handoffs current.",
      "Product should protect Route IQ operations and document material invention changes.",
      "Gaia stays paused. Athena stays architecture only.",
      "Recommendation: run the Founder customer workflow first, then close one Overwatch-recorded readiness or hardening action."
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
  } else if (normalized.includes("operation") || normalized.includes("phase")) {
    key = "operationalState";
    title = "Operating State Memory";
  } else if (normalized.includes("investor")) {
    key = "investorConversations";
    title = "Investor Conversation Memory";
  } else if (normalized.includes("company") || normalized.includes("decision")) {
    key = "companyDecisions";
    title = "Company Decision Memory";
  }

  const historicalContextRequested = key === "operationalState" && requestsHistoricalCompanyPhase(command);
  const memoryItems = key === "operationalState"
    ? operatingStateMemoryFor(command)
    : executiveMemory[key];

  return {
    title,
    body: [
      sentenceList(memoryItems),
      `Verified memory events available: ${memoryEvents.length}.`,
      "Truth rule: I will state only current facts and recorded outcomes."
    ].join(" "),
    metadata: {
      executiveCommandCenter: true,
      memoryCategory: key,
      historicalContextRequested
    }
  };
}

export function createExecutiveStrategyMeeting() {
  return {
    title: "Executive Strategy Meeting",
    body: [
      "Here is the meeting frame: name the active mission, identify the customer decision, verify the operating evidence, state the risk, and choose one next action.",
      "Current strategic read: Route IQ is operational and Patent Pending. The constraint is disciplined readiness and onboarding execution.",
      "Decision: execute the current Founder workflow, preserve every customer outcome, and close one governed readiness or hardening action before opening new product scope."
    ].join(" "),
    metadata: {
      executiveCommandCenter: true,
      conversationMode: "executive-strategy-meeting"
    }
  };
}
