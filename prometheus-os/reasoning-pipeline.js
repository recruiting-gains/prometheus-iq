import { companyState } from "./demo-data.js";
import { rankDecisionTasks } from "./decision-engine.js";
import { createDailyBrief } from "./daily-brief.js";
import { addDaysToIsoDate, getPrometheusToday, normalizeText } from "./memory-ranking.js";

function sentenceList(items, limit = 5) {
  return items.slice(0, limit).map((item) => {
    const date = item.date ? `${item.date}: ` : "";
    const impact = item.impact ? ` Impact: ${item.impact}` : "";
    return `${date}${item.title}. ${item.summary}${impact}`;
  }).join(" ");
}

function response(title, body, metadata = {}) {
  return {
    title,
    body,
    permission: "Level 0 - Read Only",
    tone: "chief-of-staff",
    metadata: {
      orchestrator: true,
      cognitive: true,
      cardFallbackUsed: false,
      ...metadata
    }
  };
}

function periodTimeline(question, evidence) {
  const normalized = normalizeText(question);
  const timeline = evidence.filter((item) => item.type === "timeline-event");
  const today = getPrometheusToday();
  const yesterday = addDaysToIsoDate(today, -1);
  const weekStart = addDaysToIsoDate(today, -7);

  if (normalized.includes("yesterday")) return timeline.filter((item) => item.date === yesterday);
  if (normalized.includes("today")) return timeline.filter((item) => item.date === today);
  if (normalized.includes("week")) return timeline.filter((item) => item.date >= weekStart && item.date <= today);
  return timeline;
}

function recapPeriod(question, evidence) {
  const timeline = periodTimeline(question, evidence);
  if (!timeline.length) {
    return response(
      "Prometheus Company Recap",
      "I do not have a new verified timeline event for that period. The current governed baseline remains: Route IQ is operational and Patent Pending, Gaia is paused, Athena is architecture only, and the company is executing readiness, onboarding, hardening, and continuous improvement.",
      { intent: "recap", truth: "current_baseline" }
    );
  }
  return response(
    "Prometheus Company Recap",
    `Here is the verified operating record: ${sentenceList(timeline, 7)} Keep the decision tied to the current Route IQ operating phase and the next governed Founder action.`,
    { intent: "recap", entities: ["Route IQ", "Overwatch"] }
  );
}

function majorSystems() {
  return response(
    "Current Prometheus Systems",
    [
      "Route IQ is the operational, Patent Pending primary product.",
      "Overwatch is the governance and trusted-state layer.",
      "CRM preserves customer stages, follow-ups, and evidence-based handoffs.",
      "Research is a read-only strategic intelligence source; Gaia is paused.",
      "Athena remains architecture only.",
      "Companion is the Founder's private executive operating system."
    ].join(" "),
    { intent: "major_systems", entities: ["Route IQ", "Overwatch", "CRM", "Gaia", "Athena", "Prometheus Companion"] }
  );
}

function productAnswer(productKey) {
  const product = companyState.products[productKey];
  return response(
    `${product.name} Status`,
    `${product.name} is ${product.status}. ${product.detail}${product.patentStatus ? ` It is ${product.patentStatus}.` : ""}`,
    { intent: `${productKey}_status`, entities: [product.name], truth: "verified" }
  );
}

function patentAnswer() {
  return response(
    "Route IQ Patent Status",
    `${companyState.patent.product} is ${companyState.patent.status}. ${companyState.patent.filing} is filed. ${companyState.patent.detail}`,
    { intent: "patent_status", entities: ["Route IQ", "Patent"], truth: "verified" }
  );
}

function phaseAnswer() {
  return response(
    "Current Company Phase",
    `Prometheus is in ${companyState.currentPhase.join(", ").toLowerCase()}. This is an operating phase: Route IQ is operational, Gaia is paused, and Athena is architecture only.`,
    { intent: "company_phase", entities: ["Prometheus", "Route IQ", "Gaia", "Athena"], truth: "verified" }
  );
}

function founderWorkflowAnswer() {
  const workflow = companyState.founderAlignment.workflow
    .map((step, index) => `${index + 1}. ${step}`)
    .join(" ");
  return response(
    "Current Founder Workflow",
    `Your role is ${companyState.founderAlignment.role.join(", ").toLowerCase()}. The current governed workflow is: ${workflow}`,
    { intent: "founder_workflow", entities: ["Cruz", "Overwatch", "CRM"], truth: "verified" }
  );
}

function websiteAnswer() {
  return response(
    "Website Context",
    "The public Prometheus website supports current Route IQ positioning and customer onboarding. Website owns the public surface; Companion provides a read-only executive summary and does not change it.",
    { intent: "website", entities: ["Website", "Route IQ"], truth: "verified" }
  );
}

function githubAnswer() {
  return response(
    "GitHub Context",
    "GitHub is part of the governed source-control, recovery, and checkpoint trail. Review scope, secrets, tests, subsystem ownership, commit intent, and push status before recording a milestone.",
    { intent: "github", entities: ["GitHub", "Overwatch"], truth: "verified" }
  );
}

function cloudflareAnswer() {
  return response(
    "Cloudflare Context",
    "Cloudflare supports public and protected platform surfaces. Remaining account-owner controls and authenticated production checks stay governed by the current Overwatch security checkpoint.",
    { intent: "cloudflare", entities: ["Cloudflare", "Overwatch"], truth: "verified" }
  );
}

function companionAnswer() {
  return response(
    "Companion Context",
    "Prometheus Companion is reactivated as the Founder's private executive operating system. It consumes current platform state, preserves the accepted visual runtime, and does not take ownership of Route IQ, Gaia, Athena, CRM, or other subsystem runtimes.",
    { intent: "companion", entities: ["Prometheus Companion", "Cruz"], truth: "verified" }
  );
}

function riskAnswer() {
  return response(
    "Biggest Prometheus Risk",
    "The biggest current risk is operating from stale or incomplete evidence while Route IQ is already live. The concrete friction is authenticated production verification, remaining account-owner security controls, incomplete customer handoff records, and ungoverned product expansion. Close one verified readiness item, then execute the active customer mission.",
    { intent: "risk", entities: ["Route IQ", "Overwatch", "Customer Onboarding"] }
  );
}

function priorityAnswer() {
  const top = rankDecisionTasks().slice(0, 3);
  return response(
    "Highest ROI Next Move",
    `First, ${top[0].title}. ${top[0].reason} Second, ${top[1].title}. Third, ${top[2].title}. The operating rule is customer movement first, verified readiness second, and no ungoverned product expansion.`,
    { intent: "priority", entities: ["Cruz", "Route IQ", "Customer Onboarding"] }
  );
}

function dailyBriefAnswer() {
  return response(
    "Daily Founder Brief",
    createDailyBrief().body,
    { intent: "founder_brief", entities: ["Cruz", "Route IQ", "Overwatch"], truth: "verified" }
  );
}

function previousAnswerText(context = {}) {
  return normalizeText([context.lastTitle, context.lastBody, context.lastCognitiveIntent, ...(context.focusEntities || [])].filter(Boolean).join(" "));
}

function followUpAnswer(context = {}) {
  const previous = previousAnswerText(context);
  if (previous.includes("route iq") || previous.includes("product")) {
    return response(
      "Why It Matters",
      "Because Route IQ is operational. The next decision should improve customer movement, operating reliability, or enterprise readiness without destabilizing the primary product.",
      { intent: "follow_up_reasoning", entities: ["Route IQ"] }
    );
  }
  if (previous.includes("risk") || previous.includes("blocker") || previous.includes("overwatch")) {
    return response(
      "Why It Matters",
      "Because trusted state is now an operating dependency. Closing the recorded blocker prevents stale assumptions from reaching customers or driving the next engineering decision.",
      { intent: "follow_up_reasoning", entities: ["Overwatch", "Customer Onboarding"] }
    );
  }
  return response(
    "Why It Matters",
    "Because the current company phase rewards execution: move the customer decision, preserve the evidence, and close the next verified operating gap.",
    { intent: "follow_up_reasoning", entities: context.focusEntities || ["Prometheus"] }
  );
}

function generalAnswer(evidence) {
  if (!evidence.length) {
    return response(
      "Prometheus Answer",
      `My best read is the current governed baseline: Route IQ is operational and Patent Pending; Gaia is paused; Athena is architecture only; and the company is in ${companyState.currentPhase.join(", ").toLowerCase()}. The next action should come from today's Founder mission or the current Overwatch checkpoint.`,
      { intent: "general", truth: "current_baseline" }
    );
  }
  return response(
    "Prometheus Intelligence Brief",
    `Here is the strongest current evidence: ${sentenceList(evidence, 4)} Use it inside the current operating phase and preserve subsystem ownership.`,
    { intent: "general" }
  );
}

export function runReasoningPipeline({ question = "", context = {}, rankedEvidence = [] } = {}) {
  const normalized = normalizeText(question);

  if (normalized.includes("route iq") || normalized.includes("route i q")) return productAnswer("routeIq");
  if (normalized.includes("gaia")) return productAnswer("gaia");
  if (normalized.includes("athena")) return productAnswer("athena");
  if (normalized.includes("patent")) return patentAnswer();
  if (normalized.includes("company phase") || normalized.includes("current phase")) return phaseAnswer();
  if (normalized.includes("founder workflow") || normalized.includes("my workflow")) return founderWorkflowAnswer();
  if (normalized.includes("website")) return websiteAnswer();
  if (normalized.includes("github") || normalized.includes("git hub")) return githubAnswer();
  if (normalized.includes("cloudflare")) return cloudflareAnswer();
  if (normalized.includes("companion")) return companionAnswer();
  if (normalized.includes("risk") || normalized.includes("blocker") || normalized.includes("slowing") || normalized.includes("bottleneck")) return riskAnswer();
  if (normalized.includes("daily brief") || normalized.includes("founder brief") || normalized === "brief" || normalized.includes("give me the brief")) return dailyBriefAnswer();
  if (normalized.includes("what should") || normalized.includes("highest roi") || normalized.includes("what matters") || normalized.includes("focus on") || normalized.includes("coo") || normalized.includes("tomorrow")) return priorityAnswer();
  if (context.isFollowUp && normalized.startsWith("why")) return followUpAnswer(context);
  if (normalized.includes("what happened") || normalized.includes("what changed") || normalized.includes("this week") || normalized.includes("yesterday") || normalized.includes("today") || normalized.includes("last month")) return recapPeriod(question, rankedEvidence);
  if (normalized.includes("major systems") || normalized.includes("systems have been built")) return majorSystems();

  return generalAnswer(rankedEvidence);
}
