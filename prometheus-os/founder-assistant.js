import { companyState, promptTemplates } from "./demo-data.js";
import { createTopThreePriorities, createNextActionBrief } from "./daily-priority-engine.js";
import { createTimelineAnswer, createUnfinishedWorkRecap, getLatestMemoryEvent } from "./memory-system.js";
import {
  createFounderAgendaBrief,
  createFounderDraftMessageBrief,
  createFounderMeetingsBrief,
  createFounderMessageSummaryBrief,
  getDefaultFounderCommunicationsService
} from "./founder-communications-consumer.js";
import {
  createFounderInstagramDirectAnswer,
  isDeveloperModeRequest,
  isFounderInstagramAnalyticsCommand
} from "./founder-instagram-analytics-consumer.js";
import {
  createBetaSummary,
  createCompanyStatusSummary,
  createDailyDecisionSupport,
  createEngineeringStatusSummary,
  createExecutiveDashboardSummary,
  createExecutiveStrategyMeeting,
  createFounderMemoryRecall,
  createFounderMorningBrief,
  createResearchSummary,
  createSalesSummary,
  createSocialMediaSummary,
  createWebsiteSummary
} from "./executive-command-center.js";

const permission = "Level 0 - Read Only";

const activePoolDecision = {
  title: "Active Pool Decision",
  body: [
    "The Active Pool decision was about quality control.",
    "Prometheus should recommend from approved, current, walk-in-relevant locations instead of mixing every known prospect into the live experience.",
    "For Anthony, that means his route stays separate from Cruz history and only uses reviewed active-pool records when the data quality is verified."
  ].join(" ")
};

function response(title, body, metadata = {}) {
  return {
    title,
    body,
    permission,
    tone: "founder-assistant",
    metadata: {
      founderAssistant: true,
      routeSelected: "founder_assistant",
      cardFallbackUsed: false,
      ...metadata
    }
  };
}

function includesAny(command, phrases) {
  return phrases.some((phrase) => command.includes(phrase));
}

function engineeringStatus() {
  const summary = createEngineeringStatusSummary();
  return response(
    summary.title,
    summary.body,
    {
      ...summary.metadata,
      intent: "engineering_status",
      entities: ["Prometheus IQ", "Prometheus Companion", "Route Intelligence"]
    }
  );
}

function catchUp() {
  const latest = getLatestMemoryEvent();
  const unfinished = createUnfinishedWorkRecap();

  return response(
    "Where We Left Off",
    [
      latest ? `Last recorded point: ${latest.date}: ${latest.title}. ${latest.summary}` : "I do not have a newly recorded memory event yet.",
      "The operating thread is clear: Prometheus has product, website, executive materials, Route Intelligence, GitHub backup discipline, and Companion founder support.",
      unfinished.body,
      "Next move: keep validation ahead of new features, capture Anthony beta proof, and keep leadership communication simple."
    ].join(" "),
    { intent: "catch_up", entities: ["Prometheus Companion", "Anthony", "Pilot"] }
  );
}

async function draftMessage(command, communicationsService) {
  const brief = await createFounderDraftMessageBrief({
    service: communicationsService,
    command
  });
  return response(
    brief.title,
    brief.body,
    {
      ...brief.metadata,
      intent: "message_drafting",
      entities: ["Cruz", "Messages", "Prometheus"]
    }
  );
}

async function meetings(communicationsService) {
  const brief = await createFounderMeetingsBrief({ service: communicationsService });
  return response(
    brief.title,
    brief.body,
    {
      ...brief.metadata,
      intent: "calendar_meetings",
      entities: ["Calendar", "Cruz"]
    }
  );
}

async function messageSummaries(communicationsService) {
  const brief = await createFounderMessageSummaryBrief({ service: communicationsService });
  return response(
    brief.title,
    brief.body,
    {
      ...brief.metadata,
      intent: "message_summaries",
      entities: ["Messages", "Cruz"]
    }
  );
}

async function planDay(command, communicationsService) {
  const agenda = await createFounderAgendaBrief({
    service: communicationsService,
    command
  });
  const top = createTopThreePriorities();
  return response(
    agenda.title,
    `${agenda.body} ${top.body}`,
    {
      ...agenda.metadata,
      intent: "day_planning",
      entities: ["Cruz", "Pilot", "Anthony", "Calendar"]
    }
  );
}

function longTermGoals() {
  return response(
    "Long-Term Founder Goals",
    [
      "Your long-term goals are clear.",
      "First, prove Prometheus IQ creates measurable field-sales value before scaling features.",
      "Second, turn Anthony beta and controlled pilot usage into credible external proof.",
      "Third, win a clean leadership-approved pilot without exposing proprietary route logic.",
      "Fourth, build Prometheus as a recoverable company system with memory, security, source control, and founder continuity.",
      "Fifth, make Route Intelligence the durable advantage: where to go, why it matters, verified activity, and learning from outcomes."
    ].join(" "),
    { intent: "long_term_goals", entities: ["Cruz", "Prometheus IQ", "Pilot"] }
  );
}

function pricing() {
  return response(
    "Pricing Direction",
    "Price the feature around operational value, not raw software access. For pilot conversations, avoid locking a final number before proof. A defensible path is: controlled pilot first, then price by seat or territory with a manager visibility layer, using verified visits, route quality, and time saved as value anchors. Do not discount the core Route Intelligence advantage into a generic dashboard subscription.",
    { intent: "pricing_strategy", entities: ["Prometheus IQ", "Route Intelligence", "Pilot"] }
  );
}

function strategyCritique() {
  return response(
    "Strategy Weaknesses",
    [
      "The main weakness is overbuilding before external validation catches up.",
      "The second weakness is relying too heavily on founder intuition instead of recorded Anthony feedback and verified visit data.",
      "The third is letting public polish, social, or Companion improvements outrank pilot proof.",
      "The fourth is pricing or executive claims getting ahead of evidence.",
      "Correction: keep every week tied to one proof loop: route quality, usage, feedback, leadership clarity, and clean memory."
    ].join(" "),
    { intent: "strategy_critique", entities: ["Cruz", "Pilot", "Anthony"] }
  );
}

function dashboardDataArchitecture() {
  return response(
    "Dashboard and Data Boundary",
    [
      "The Dashboard is the Prometheus IQ product surface. It shows approved route recommendations, rep activity, manager views, and user-facing outcomes.",
      "Data prepares and governs the underlying business records, route pools, imports, exports, and runtime data.",
      "Companion should not own that product surface. Companion can explain status and summarize decisions, but it should not change Dashboard screens or Data records.",
      "The clean boundary is this: Data supplies governed records, Route Intelligence selects usable routes, Dashboard presents them to users, and Companion briefs Cruz on state and decisions."
    ].join(" "),
    { intent: "dashboard_data_architecture", entities: ["Dashboard", "Data", "Route Intelligence", "Prometheus Companion"] }
  );
}

function overwatchAssignment() {
  return response(
    "Overwatch Next Assignment",
    "Overwatch should assign the next task to whatever most directly improves founder acceptance and pilot proof. Current recommendation: validate Companion voice and founder-command reliability, then move back to Anthony beta evidence and leadership-ready reporting. Do not assign Dashboard, Data, or Infrastructure work unless a verified Companion blocker depends on it.",
    { intent: "overwatch_assignment", entities: ["Overwatch", "Prometheus Companion", "Anthony"] }
  );
}

function productionBlockers() {
  return response(
    "Production Blockers",
    "Remaining blockers are external validation and integration proof, not a lack of internal build activity: Anthony beta feedback, verified visit data, leadership approval path, real calendar/message integration for Companion, and continued voice reliability testing. New feature work should wait unless it removes one of those blockers.",
    { intent: "production_blockers", entities: ["Anthony", "Pilot", "Prometheus Companion"] }
  );
}

function morningGreeting() {
  const next = createNextActionBrief();
  return response(
    "Good Morning, Cruz",
    `Good morning, Cruz. Companion is online. Highest ROI: ${next.body} I can catch you up, plan the day, draft a message, review memory, or brief Prometheus engineering status.`,
    { intent: "greeting", entities: ["Cruz", "Prometheus Companion"] }
  );
}

function developerMode() {
  return response(
    "Developer Mode",
    "Developer Mode is available when you ask for a specific technical view. By default, I will stay in Founder Mode and keep answers concise, strategic, and spoken for executive use.",
    {
      intent: "developer_mode",
      developerMode: true,
      founderMode: false,
      entities: ["Prometheus Companion"]
    }
  );
}

export async function createFounderAssistantResponse(command = "", {
  communicationsService = getDefaultFounderCommunicationsService(),
  socialMediaAnalyticsService
} = {}) {
  const normalized = String(command || "").toLowerCase().trim();
  if (!normalized) return null;

  if (/^(good morning|morning companion|good morning companion|hello companion|hey companion)\b/.test(normalized)) return morningGreeting();
  if (includesAny(normalized, ["founder morning brief", "morning brief", "executive morning brief", "start my morning"])) {
    const brief = await createFounderMorningBrief({ communicationsService, socialMediaAnalyticsService });
    return response(brief.title, brief.body, {
      ...brief.metadata,
      intent: "founder_morning_brief",
      entities: ["Cruz", "Prometheus Companion", "Calendar", "Priorities"]
    });
  }
  if (isFounderInstagramAnalyticsCommand(normalized)) {
    const instagram = await createFounderInstagramDirectAnswer({
      command: normalized,
      service: socialMediaAnalyticsService
    });
    return response(instagram.title, instagram.body, {
      ...instagram.metadata,
      entities: ["Instagram", "Prometheus Social Media", "Prometheus Companion"]
    });
  }
  if (isDeveloperModeRequest(normalized)) return developerMode();
  if (includesAny(normalized, ["executive dashboard", "executive command center", "command center summary"])) {
    const dashboard = createExecutiveDashboardSummary();
    return response(dashboard.title, dashboard.body, {
      ...dashboard.metadata,
      intent: "executive_dashboard",
      entities: ["Prometheus", "Prometheus IQ", "Prometheus Companion"]
    });
  }
  if (includesAny(normalized, ["company status", "prometheus status", "where does the company stand"])) {
    const company = createCompanyStatusSummary();
    return response(company.title, company.body, {
      ...company.metadata,
      intent: "company_status",
      entities: ["Prometheus", "Prometheus IQ", "Cruz"]
    });
  }
  if (includesAny(normalized, ["daily decision support", "help me decide", "prioritize engineering marketing sales product", "prioritize today"])) {
    const decision = createDailyDecisionSupport();
    return response(decision.title, decision.body, {
      ...decision.metadata,
      intent: "daily_decision_support",
      entities: ["Engineering", "Marketing", "Sales", "Product"]
    });
  }
  if (includesAny(normalized, ["research summary", "summarize research", "research status"])) {
    const research = createResearchSummary();
    return response(research.title, research.body, {
      ...research.metadata,
      intent: "research_summary",
      entities: ["Research", "Founder Intelligence Brief"]
    });
  }
  if (includesAny(normalized, ["sales summary", "summarize sales", "sales status"])) {
    const sales = createSalesSummary();
    return response(sales.title, sales.body, {
      ...sales.metadata,
      intent: "sales_summary",
      entities: ["Sales", "Pilot", "Customers"]
    });
  }
  if (includesAny(normalized, ["website summary", "summarize website", "website status"])) {
    const website = createWebsiteSummary();
    return response(website.title, website.body, {
      ...website.metadata,
      intent: "website_summary",
      entities: ["Website", "PrometheusRouteIQ.com"]
    });
  }
  if (includesAny(normalized, ["social media summary", "summarize social", "social status", "marketing summary"])) {
    const social = createSocialMediaSummary();
    return response(social.title, social.body, {
      ...social.metadata,
      intent: "social_media_summary",
      entities: ["Social Media", "Founder Marketing"]
    });
  }
  if (includesAny(normalized, ["beta summary", "anthony beta summary", "beta status"])) {
    const beta = createBetaSummary();
    return response(beta.title, beta.body, {
      ...beta.metadata,
      intent: "beta_summary",
      entities: ["Anthony", "Beta", "Prometheus IQ"]
    });
  }
  if (includesAny(normalized, ["executive strategy meeting", "strategy meeting", "run strategy meeting"])) {
    const meeting = createExecutiveStrategyMeeting();
    return response(meeting.title, meeting.body, {
      ...meeting.metadata,
      intent: "executive_strategy_meeting",
      entities: ["Cruz", "Prometheus"]
    });
  }
  if (
    includesAny(normalized, [
      "company decisions",
      "product decisions",
      "engineering milestones",
      "beta findings",
      "investor conversations",
      "founder memory",
      "what do you remember"
    ])
  ) {
    const memory = createFounderMemoryRecall(normalized);
    return response(memory.title, memory.body, {
      ...memory.metadata,
      intent: "founder_memory_recall",
      entities: ["Founder Memory", "Prometheus"]
    });
  }
  if (includesAny(normalized, ["catch me up", "where we left off", "resume context", "left off"])) return catchUp();
  if (includesAny(normalized, ["current engineering status", "engineering status of prometheus", "prometheus engineering status", "engineering status"])) return engineeringStatus();
  if (includesAny(normalized, ["message summary", "message summaries", "summarize messages", "summarise messages", "inbox summary", "what messages"])) return messageSummaries(communicationsService);
  if (includesAny(normalized, ["draft a message", "write a message", "help me draft", "draft an email", "write an email", "compose a message", "compose message"])) return draftMessage(normalized, communicationsService);
  if (includesAny(normalized, ["meetings i have", "my meetings", "calendar reminders", "calendar reminder", "calendar", "schedule today"])) return meetings(communicationsService);
  if (includesAny(normalized, ["long term goals", "long-term goals", "founder goals", "my goals"])) return longTermGoals();
  if (includesAny(normalized, ["plan my day", "daily agenda", "todays agenda", "today agenda", "plan today", "day plan"])) return planDay(normalized, communicationsService);
  if (includesAny(normalized, ["price this feature", "pricing", "how should we price"])) return pricing();
  if (includesAny(normalized, ["active pool"])) return response(activePoolDecision.title, activePoolDecision.body, { intent: "active_pool_decision", entities: ["Active Pool", "Route Intelligence", "Data"] });
  if (includesAny(normalized, ["weaknesses in my current strategy", "weakness in my strategy", "critique my strategy", "strategy weaknesses"])) return strategyCritique();
  if (includesAny(normalized, ["dashboard interact with the data", "dashboard interacts with the data", "dashboard and data", "dashboard data architecture"])) return dashboardDataArchitecture();
  if (includesAny(normalized, ["overwatch assign", "overwatch should assign", "what should overwatch"])) return overwatchAssignment();
  if (includesAny(normalized, ["production blockers", "blockers remain", "remaining blockers"])) return productionBlockers();
  if (includesAny(normalized, ["founder briefing", "founder brief", "brief me as founder"])) {
    const timeline = createTimelineAnswer("this week");
    return response("Founder Briefing", `${timeline.body} ${promptTemplates.dailyBrief}`, { intent: "founder_briefing", entities: ["Cruz", "Prometheus Companion"] });
  }

  return null;
}
