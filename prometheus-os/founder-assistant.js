import { companyState, promptTemplates } from "./demo-data.js";
import { createTopThreePriorities, createNextActionBrief } from "./daily-priority-engine.js";
import { createTimelineAnswer, createUnfinishedWorkRecap, getLatestMemoryEvent } from "./memory-system.js";

const permission = "Level 0 - Read Only";

const activePoolDecision = {
  title: "Active Pool Decision",
  body: [
    "The Active Pool decision was to keep runtime route data separated into an active, founder-safe pool instead of mixing every known prospect into the live recommendation surface.",
    "The point is quality control: the runtime should favor approved, current, walk-in-relevant records and avoid stale, restricted, generic, or founder-biased locations.",
    "For Anthony, that means his route should be isolated from Cruz history and should only consume the reviewed active pool when the data quality is verified."
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
  const cards = companyState.statusCards
    .filter((card) => ["website", "anthony", "route", "github", "cloudflare", "pilot", "executive"].includes(card.key))
    .map((card) => `${card.label}: ${card.value} - ${card.detail}`);

  return response(
    "Prometheus Engineering Status",
    [
      "Current status: Prometheus is in validation mode, not public-dashboard expansion mode.",
      ...cards,
      "Companion status: private founder assistant, voice path, local memory, and reasoning are active but long-term automated ingestion still needs hardening.",
      "Main engineering standard: protect beta stability, keep Dashboard/Data/Infrastructure boundaries clean, and only build features that improve pilot proof."
    ].join(" "),
    { intent: "engineering_status", entities: ["Prometheus IQ", "Prometheus Companion", "Route Intelligence"] }
  );
}

function catchUp() {
  const latest = getLatestMemoryEvent();
  const unfinished = createUnfinishedWorkRecap();

  return response(
    "Where We Left Off",
    [
      latest ? `Latest verified memory: ${latest.date}: ${latest.title}. ${latest.summary}` : "No verified latest memory event is available.",
      "The operating thread is clear: Prometheus has product, website, executive materials, Route Intelligence, GitHub backup discipline, and Companion founder support.",
      unfinished.body,
      "Next move: keep validation ahead of new features, capture Anthony beta proof, and keep leadership communication simple."
    ].join(" "),
    { intent: "catch_up", entities: ["Prometheus Companion", "Anthony", "Pilot"] }
  );
}

function draftMessage(command) {
  const toChris = command.includes("chris") || command.includes("leadership") || command.includes("pilot");
  const draft = toChris
    ? "Chris, quick update: Prometheus is ready for a controlled pilot conversation. The ask is intentionally simple: a limited 14-day test, approved users only, GPS-verified activity, weekly review, and a final results report. I can keep proprietary routing logic out of the conversation unless leadership wants a deeper review under the right approval path. What would Dallas leadership need from me next to evaluate this cleanly?"
    : "Here is a clean founder message draft: Quick update from Prometheus: the product foundation is real, the next priority is validation, and I am keeping the ask focused on measurable field-sales proof instead of extra features. The next step is to collect useful feedback, confirm the blocker, and decide the smallest action that moves the pilot forward.";

  return response(
    "Message Draft",
    draft,
    { intent: "message_drafting", entities: toChris ? ["Chris", "Pilot"] : ["Cruz", "Prometheus"] }
  );
}

function meetings() {
  return response(
    "Meeting View",
    "I do not have live calendar access connected in Companion yet, so I cannot truthfully list Cruz's actual meetings. Safe placeholder: review leadership follow-up, Anthony beta feedback, Companion voice acceptance, and daily operating log. Missing integration: calendar connector or local calendar import needs to be added before I can show real meetings.",
    { intent: "calendar_placeholder", truth: "missing_integration", entities: ["Calendar", "Cruz"] }
  );
}

function planDay() {
  const top = createTopThreePriorities();
  return response(
    "Founder Day Plan",
    [
      "Plan the day around proof, not activity.",
      top.body,
      "Suggested rhythm: morning review of blockers and messages, midday Anthony/beta validation work, afternoon leadership or customer-facing follow-up, evening memory log and backup review.",
      "Calendar note: live calendar data is not connected yet, so this plan is based on Prometheus memory and priorities rather than Cruz's actual meeting schedule."
    ].join(" "),
    { intent: "day_planning", truth: "calendar_placeholder", entities: ["Cruz", "Pilot", "Anthony"] }
  );
}

function longTermGoals() {
  return response(
    "Long-Term Founder Goals",
    [
      "1. Prove Prometheus IQ creates measurable field-sales value before scaling features.",
      "2. Turn Anthony beta and controlled pilot usage into credible external proof.",
      "3. Win a clean leadership-approved pilot without exposing proprietary route logic.",
      "4. Build Prometheus as a recoverable company system with memory, security, source control, and founder continuity.",
      "5. Convert Route Intelligence into the durable product advantage: where to go, why it matters, verified activity, and learning from outcomes."
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
      "Second weakness: relying too heavily on founder intuition instead of recorded Anthony feedback and verified visit data.",
      "Third weakness: letting public polish, social, or Companion UI improvements outrank pilot proof.",
      "Fourth weakness: pricing or executive claims could get ahead of evidence if real beta outcomes are not captured.",
      "Correction: keep every week tied to one proof loop: route quality, usage, feedback, leadership clarity, and clean memory."
    ].join(" "),
    { intent: "strategy_critique", entities: ["Cruz", "Pilot", "Anthony"] }
  );
}

function dashboardDataArchitecture() {
  return response(
    "Dashboard and Data Boundary",
    [
      "The Dashboard should be the Prometheus IQ product UI: it displays approved runtime state, route recommendations, rep activity, manager views, and user-facing outcomes.",
      "The Data subsystem should prepare and govern the underlying business records, route pools, import/export state, and versioned runtime data.",
      "Companion must not own that runtime UI. Companion can explain status, summarize decisions, and verify drift, but it should not modify Dashboard-owned Prometheus IQ screens or Data-owned source records.",
      "The correct boundary is: Data supplies governed records, Route Intelligence scores and selects usable routes, Dashboard presents them to users, and Companion briefs Cruz on state and decisions."
    ].join(" "),
    { intent: "dashboard_data_architecture", entities: ["Dashboard", "Data", "Route Intelligence", "Prometheus Companion"] }
  );
}

function overwatchAssignment() {
  return response(
    "Overwatch Next Assignment",
    "Overwatch should assign the next task to whatever most directly improves founder acceptance and pilot proof. Current recommendation: validate Companion voice and founder-command reliability, then move back to Anthony beta evidence and leadership-ready reporting. Do not assign Dashboard, Data, or Infrastructure work unless a verified Companion blocker depends on that subsystem.",
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

export function createFounderAssistantResponse(command = "") {
  const normalized = String(command || "").toLowerCase().trim();
  if (!normalized) return null;

  if (/^(good morning|morning companion|good morning companion|hello companion|hey companion)\b/.test(normalized)) return morningGreeting();
  if (includesAny(normalized, ["catch me up", "where we left off", "resume context", "left off"])) return catchUp();
  if (includesAny(normalized, ["current engineering status", "engineering status of prometheus", "prometheus engineering status"])) return engineeringStatus();
  if (includesAny(normalized, ["draft a message", "write a message", "help me draft", "draft an email", "write an email"])) return draftMessage(normalized);
  if (includesAny(normalized, ["meetings i have", "my meetings", "calendar", "schedule today"])) return meetings();
  if (includesAny(normalized, ["long term goals", "long-term goals", "founder goals", "my goals"])) return longTermGoals();
  if (includesAny(normalized, ["plan my day", "plan today", "day plan"])) return planDay();
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
