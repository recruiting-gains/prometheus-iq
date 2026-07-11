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
  createFounderInfrastructureBriefing,
  createFounderSocialMediaBriefing,
  isFounderInfrastructureBriefingCommand,
  isFounderSocialMediaBriefingCommand
} from "./founder-subsystem-briefing-consumer.js";
import {
  createCompanyStatusSummary,
  createCrmSummary,
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
    "Route IQ should use governed, workspace-specific active-pool records whose quality and current operating relevance are verified."
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

function isExact(command, phrases) {
  return phrases.some((phrase) => command === phrase);
}

function timelineBrief(founderTimeline) {
  if (!founderTimeline?.ok) return "";
  const latestCommit = founderTimeline.commits?.[0];
  const verification = founderTimeline.verification?.result ? `Latest Companion verification: ${founderTimeline.verification.result}.` : "";
  const commit = latestCommit ? `Latest commit: ${latestCommit.shortHash} ${latestCommit.subject}.` : "";
  const checkpoints = Array.isArray(founderTimeline.checkpoints)
    ? founderTimeline.checkpoints.slice(0, 3).map((item) => `${item.area}: ${item.status}`).join(". ")
    : "";
  return [commit, verification, checkpoints].filter(Boolean).join(" ");
}

function engineeringStatus(founderTimeline) {
  const summary = createEngineeringStatusSummary();
  const timeline = timelineBrief(founderTimeline);
  return response(
    summary.title,
    timeline ? `${summary.body} ${timeline}` : summary.body,
    {
      ...summary.metadata,
      intent: "engineering_status",
      entities: ["Route IQ", "Prometheus Companion", "Overwatch"]
    }
  );
}

function catchUp(founderTimeline) {
  const latest = getLatestMemoryEvent();
  const unfinished = createUnfinishedWorkRecap();
  const timeline = timelineBrief(founderTimeline);

  return response(
    "Where We Left Off",
    [
      timeline ? `Live operating signal: ${timeline}` : "",
      latest ? `Last recorded point: ${latest.date}: ${latest.title}. ${latest.summary}` : "I do not have a newly recorded memory event yet.",
      "The operating thread is clear: Route IQ is operational and Patent Pending, Gaia is paused, Athena is architecture only, and Companion is reactivated for the Founder.",
      unfinished.body,
      `Next move: ${companyState.chiefOfStaff.recommendedNextAction}`
    ].join(" "),
    { intent: "catch_up", entities: ["Prometheus Companion", "Route IQ", "Overwatch"] }
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
      entities: ["Cruz", "Customer Onboarding", "Calendar", "Founder Workflow"]
    }
  );
}

function longTermGoals() {
  return response(
    "Long-Term Founder Goals",
    [
      "The recorded long-term goals are:",
      "First, make outside sales intelligent, directed, accountable, and compounding through Route IQ.",
      "Second, turn an operational Route IQ into repeatable customer onboarding and enterprise-ready delivery.",
      "Third, preserve the Patent Pending invention while documenting material Route IQ improvements.",
      "Fourth, build Prometheus as a recoverable company system with governed memory, security, source control, and Founder continuity.",
      "Fifth, expand Gaia or Athena only when governed company evidence justifies moving beyond the current product phase."
    ].join(" "),
    { intent: "long_term_goals", entities: ["Cruz", "Prometheus", "Route IQ", "Gaia", "Athena"] }
  );
}

function pricing() {
  return response(
    "Pricing Direction",
    "Price Route IQ around operational value, not raw software access. Use current customer-onboarding evidence such as directed coverage, verified activity, decision quality, and time saved. Keep pricing aligned with the current commercial package and do not reduce the Patent Pending operating advantage to a generic dashboard subscription.",
    { intent: "pricing_strategy", entities: ["Route IQ", "Customer Onboarding", "Sales"] }
  );
}

function strategyCritique() {
  return response(
    "Strategy Weaknesses",
    [
      "The main weakness would be treating an operational product as if the company were still searching for product identity.",
      "The second is letting implementation work outrun customer onboarding and CRM evidence.",
      "The third is leaving authenticated verification or account-owner security controls open while enterprise expectations rise.",
      "The fourth is expanding Gaia or Athena before the current Route IQ operating phase earns that shift.",
      "Correction: tie each week to the active workspace mission, customer movement, verified readiness, and one measurable operational improvement."
    ].join(" "),
    { intent: "strategy_critique", entities: ["Cruz", "Route IQ", "Customer Onboarding", "Overwatch"] }
  );
}

function dashboardDataArchitecture() {
  return response(
    "Dashboard and Data Boundary",
    [
      "The Dashboard is a Route IQ product surface. It presents approved operating information and user-facing outcomes.",
      "Data prepares and governs the underlying business records, route pools, imports, exports, and runtime data.",
      "Companion should not own that product surface. Companion can explain status and summarize decisions, but it should not change Dashboard screens or Data records.",
      "The clean boundary is this: Data supplies governed records, Route IQ applies its operational intelligence, Dashboard presents approved outcomes, and Companion briefs Cruz on current state and decisions."
    ].join(" "),
    { intent: "dashboard_data_architecture", entities: ["Dashboard", "Data", "Route IQ", "Prometheus Companion"] }
  );
}

function overwatchAssignment() {
  return response(
    "Overwatch Next Assignment",
    "Overwatch should assign the next task that closes a verified deployment-readiness, customer-onboarding, or enterprise-hardening gap while preserving Route IQ operations. Current recommendation: finish the next recorded authenticated verification or account-owner control, then return the Founder to the active customer mission. Do not reopen Gaia or Athena without a governed phase change.",
    { intent: "overwatch_assignment", entities: ["Overwatch", "Route IQ", "Customer Onboarding"] }
  );
}

function productionBlockers() {
  return response(
    "Production Blockers",
    "The remaining recorded blockers are operational: authenticated production verification, outstanding account-owner security controls, complete customer-onboarding evidence, and any current subsystem-specific verification failures recorded by Overwatch. Route IQ itself is operational.",
    { intent: "production_blockers", entities: ["Route IQ", "Overwatch", "Enterprise Hardening"] }
  );
}

function advice() {
  return response(
    "Founder Advice",
    [
      "Do not open another product thread today.",
      "Route IQ is operational. Use it to move a real customer decision forward.",
      "Start in the active workspace, set Today's Mission, review the Research dossier, call the highest-value prospects, and preserve every outcome in CRM."
    ].join(" "),
    { intent: "founder_advice", founderMode: true, entities: ["Cruz", "Route IQ", "Founder Workflow"] }
  );
}

function morningGreeting() {
  return response(
    "Good Morning",
    "Good morning. What are we working on?",
    { intent: "greeting", entities: ["Cruz", "Prometheus Companion"] }
  );
}

function naturalGreeting() {
  return response(
    "I'm Here",
    "I'm here. What are we working on?",
    { intent: "natural_greeting", founderMode: true, entities: ["Cruz", "Prometheus Companion"] }
  );
}

function healthGreeting() {
  return response(
    "Ready",
    "I'm online. What would you like to tackle?",
    { intent: "health_greeting", founderMode: true, entities: ["Prometheus Companion"] }
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

function routeIqStatus() {
  const product = companyState.products.routeIq;
  return response(
    "Route IQ Status",
    `${product.name} is ${product.status}, ${product.patentStatus}, and the ${product.role.toLowerCase()}. The current operating focus is deployment readiness, customer onboarding, enterprise hardening, and continuous operational improvement.`,
    { intent: "route_iq_status", founderMode: true, entities: ["Route IQ", "Overwatch"] }
  );
}

function gaiaStatus() {
  const product = companyState.products.gaia;
  return response(
    "Gaia Status",
    `${product.name} is ${product.status.toLowerCase()}. ${product.detail} Route IQ remains the primary product.`,
    { intent: "gaia_status", founderMode: true, entities: ["Gaia", "Route IQ"] }
  );
}

function athenaStatus() {
  const product = companyState.products.athena;
  return response(
    "Athena Status",
    `${product.name} is ${product.status.toLowerCase()}. ${product.detail} It should not be described as an operational product.`,
    { intent: "athena_status", founderMode: true, entities: ["Athena", "Route IQ"] }
  );
}

function patentStatus() {
  return response(
    "Route IQ Patent Status",
    `${companyState.patent.product} is ${companyState.patent.status}. ${companyState.patent.filing} is filed. Material invention changes must continue to be documented in the governed patent workspace.`,
    { intent: "patent_status", founderMode: true, entities: ["Route IQ", "Patent"] }
  );
}

function companyPhase() {
  return response(
    "Current Company Phase",
    `Prometheus is in ${companyState.currentPhase.join(", ").toLowerCase()}. Route IQ is operational; Gaia is paused; Athena is architecture only.`,
    { intent: "company_phase", founderMode: true, entities: ["Prometheus", "Route IQ", "Gaia", "Athena"] }
  );
}

function founderWorkflow() {
  const steps = companyState.founderAlignment.workflow
    .map((step, index) => `${index + 1}. ${step}`)
    .join(" ");
  return response(
    "Current Founder Workflow",
    `Your current role is ${companyState.founderAlignment.role.join(", ").toLowerCase()}. The governed workflow is: ${steps}`,
    { intent: "founder_workflow", founderMode: true, entities: ["Cruz", "Founder Workflow", "Overwatch"] }
  );
}

function crmPipelineSummary() {
  const crm = createCrmSummary();
  return response(
    "CRM Pipeline Summary",
    [
      "CRM is the governed continuity layer for customer onboarding.",
      crm.body,
      "Advice: update the candidate stage after every call, preserve readiness evidence, and hand off to JR only when the record supports it. Companion remains read-only to CRM unless an approved integration explicitly allows an action."
    ].join(" "),
    {
      ...crm.metadata,
      intent: "crm_pipeline_summary",
      founderMode: true,
      entities: ["CRM", "Sales", "Pipeline"]
    }
  );
}

function companyBriefing() {
  const company = createCompanyStatusSummary();
  return response(
    "Executive Company Briefing",
    [
      "Prometheus is in an operational company phase.",
      company.body,
      "Advice: keep Route IQ stable, run the active customer mission, and close verified readiness and hardening work before expanding the product set."
    ].join(" "),
    {
      ...company.metadata,
      intent: "executive_company_briefing",
      founderMode: true,
      entities: ["Prometheus", "Cruz", "Route IQ", "Overwatch"]
    }
  );
}

async function conversationalIntentResponse(normalized, { socialMediaAnalyticsService, founderTimeline } = {}) {
  if (isExact(normalized, ["hello", "hi", "hey"])) return naturalGreeting();
  if (isExact(normalized, ["good morning", "morning"])) return morningGreeting();
  if (isExact(normalized, ["how are you", "how are you doing", "how are things"])) return healthGreeting();
  if (isExact(normalized, ["overwatch"])) return engineeringStatus(founderTimeline);
  if (isExact(normalized, ["route iq", "route i q"])) return routeIqStatus();
  if (isExact(normalized, ["gaia"])) return gaiaStatus();
  if (isExact(normalized, ["athena"])) return athenaStatus();
  if (isExact(normalized, ["infrastructure"])) {
    const infrastructure = createFounderInfrastructureBriefing({ founderTimeline });
    return response(infrastructure.title, infrastructure.body, {
      ...infrastructure.metadata,
      founderMode: true,
      entities: ["Infrastructure", "Cloudflare", "Operation Aegis", "Prometheus Companion"]
    });
  }
  if (isExact(normalized, ["social", "social media"])) {
    const social = await createFounderSocialMediaBriefing({
      command: normalized,
      service: socialMediaAnalyticsService
    });
    return response(social.title, social.body, {
      ...social.metadata,
      founderMode: true,
      entities: ["Social Media", "Instagram", "Prometheus Companion"]
    });
  }
  if (isExact(normalized, ["instagram"])) {
    const instagram = await createFounderInstagramDirectAnswer({
      command: "instagram",
      service: socialMediaAnalyticsService
    });
    return response(instagram.title, instagram.body, {
      ...instagram.metadata,
      founderMode: true,
      entities: ["Instagram", "Prometheus Social Media", "Prometheus Companion"]
    });
  }
  if (isExact(normalized, ["website", "site"])) {
    const website = createWebsiteSummary();
    return response("Website Performance Summary", website.body, {
      ...website.metadata,
      intent: "website_performance_summary",
      founderMode: true,
      entities: ["Website", "PrometheusRouteIQ.com"]
    });
  }
  if (isExact(normalized, ["crm", "pipeline"])) return crmPipelineSummary();
  if (isExact(normalized, ["advice", "advise me"])) return advice();
  if (includesAny(normalized, ["company briefing"])) return companyBriefing();
  return null;
}

export async function createFounderAssistantResponse(command = "", {
  communicationsService = getDefaultFounderCommunicationsService(),
  socialMediaAnalyticsService,
  founderTimeline
} = {}) {
  const normalized = String(command || "").toLowerCase().trim();
  if (!normalized) return null;

  const conversationalResponse = await conversationalIntentResponse(normalized, {
    socialMediaAnalyticsService,
    founderTimeline
  });
  if (conversationalResponse) return conversationalResponse;

  if (/^(good morning|morning companion|good morning companion|hello companion|hey companion)\b/.test(normalized)) return morningGreeting();
  if (includesAny(normalized, ["founder morning brief", "morning brief", "executive morning brief", "start my morning"])) {
    const brief = await createFounderMorningBrief({ communicationsService, socialMediaAnalyticsService });
    return response(brief.title, brief.body, {
      ...brief.metadata,
      intent: "founder_morning_brief",
      entities: ["Cruz", "Prometheus Companion", "Calendar", "Priorities"]
    });
  }
  if (isFounderInfrastructureBriefingCommand(normalized)) {
    const infrastructure = createFounderInfrastructureBriefing({ founderTimeline });
    return response(infrastructure.title, infrastructure.body, {
      ...infrastructure.metadata,
      entities: ["Infrastructure", "Cloudflare", "Operation Aegis", "Prometheus Companion"]
    });
  }
  if (isFounderSocialMediaBriefingCommand(normalized)) {
    const social = await createFounderSocialMediaBriefing({
      command: normalized,
      service: socialMediaAnalyticsService
    });
    return response(social.title, social.body, {
      ...social.metadata,
      entities: ["Social Media", "Instagram", "Prometheus Companion"]
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
      entities: ["Prometheus", "Route IQ", "Prometheus Companion"]
    });
  }
  if (includesAny(normalized, ["company status", "prometheus status", "where does the company stand"])) {
    const company = createCompanyStatusSummary();
    return response(company.title, company.body, {
      ...company.metadata,
      intent: "company_status",
      entities: ["Prometheus", "Route IQ", "Cruz"]
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
      entities: ["Sales", "Customer Onboarding", "CRM"]
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
  if (includesAny(normalized, ["route iq status", "route i q status", "current route iq", "current route i q", "route iqs current status", "route i qs current status"])) return routeIqStatus();
  if (includesAny(normalized, ["gaia status", "current gaia", "gaias current status"])) return gaiaStatus();
  if (includesAny(normalized, ["athena status", "current athena", "athenas current status"])) return athenaStatus();
  if (includesAny(normalized, ["patent status", "patent pending", "route iq patent", "route i q patent"])) return patentStatus();
  if (!normalized.includes("remember") && includesAny(normalized, ["company phase", "current phase", "what phase are we in"])) return companyPhase();
  if (includesAny(normalized, ["founder workflow", "current founder workflow", "my workflow", "how do i run the company today"])) return founderWorkflow();
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
  if (includesAny(normalized, ["catch me up", "where we left off", "resume context", "left off"])) return catchUp(founderTimeline);
  if (includesAny(normalized, ["current engineering status", "engineering status of prometheus", "prometheus engineering status", "engineering status"])) return engineeringStatus(founderTimeline);
  if (includesAny(normalized, ["message summary", "message summaries", "summarize messages", "summarise messages", "inbox summary", "what messages"])) return messageSummaries(communicationsService);
  if (includesAny(normalized, ["draft a message", "write a message", "help me draft", "draft an email", "write an email", "compose a message", "compose message"])) return draftMessage(normalized, communicationsService);
  if (includesAny(normalized, ["meetings i have", "my meetings", "calendar reminders", "calendar reminder", "calendar", "schedule today"])) return meetings(communicationsService);
  if (includesAny(normalized, ["long term goals", "long-term goals", "founder goals", "my goals"])) return longTermGoals();
  if (includesAny(normalized, ["plan my day", "daily agenda", "todays agenda", "today agenda", "plan today", "day plan"])) return planDay(normalized, communicationsService);
  if (includesAny(normalized, ["price this feature", "pricing", "how should we price"])) return pricing();
  if (includesAny(normalized, ["active pool"])) return response(activePoolDecision.title, activePoolDecision.body, { intent: "active_pool_decision", entities: ["Active Pool", "Route IQ", "Data"] });
  if (includesAny(normalized, ["weaknesses in my current strategy", "weakness in my strategy", "critique my strategy", "strategy weaknesses"])) return strategyCritique();
  if (includesAny(normalized, ["dashboard interact with the data", "dashboard interacts with the data", "dashboard and data", "dashboard data architecture"])) return dashboardDataArchitecture();
  if (includesAny(normalized, ["overwatch assign", "overwatch should assign", "what should overwatch"])) return overwatchAssignment();
  if (includesAny(normalized, ["production blockers", "blockers remain", "remaining blockers"])) return productionBlockers();
  if (isExact(normalized, ["advice", "advise me"]) || includesAny(normalized, ["give me advice", "what is your advice"])) return advice();
  if (includesAny(normalized, ["founder briefing", "founder brief", "brief me as founder"])) {
    const timeline = createTimelineAnswer("this week");
    return response("Founder Briefing", `${timeline.body} ${promptTemplates.dailyBrief}`, { intent: "founder_briefing", entities: ["Cruz", "Prometheus Companion"] });
  }

  return null;
}
