import { routeCommandIntent } from "../prometheus-os/intent-router.js";
import { routeCommandToTool } from "../prometheus-os/agent-actions.js";
import { AIProvider } from "../prometheus-os/ai-provider.js";

const cases = [
  ["Prometheus, email", "clarification", "email_clarification", null],
  ["Prometheus, draft an email", "tool", "email_assistant", "createEmailAssistantClarification"],
  ["Prometheus, prepare an email to Chris", "tool", "email_assistant", "createEmailAssistantClarification"],
  ["Prometheus, pilot readiness", "tool", "pilot_blockers", "createPilotBlockerBrief"],
  ["Prometheus, give me today's brief", "tool", "daily_brief", "createDailyBrief"],
  ["Prometheus, what changed today", "tool", "progress_log", "createProgressLogEntry"],
  ["Prometheus, founder scorecard", "tool", "founder_scorecard", "createFounderScorecard"],
  ["Prometheus, what is blocking the pilot", "tool", "pilot_blockers", "createPilotBlockerBrief"],
  ["Prometheus, prepare GitHub backup", "tool", "github_backup", "createGithubBackupChecklist"],
  ["Prometheus, what should I do next", "tool", "next_action", "createNextActionBrief"],
  ["Prometheus, what's the move", "tool", "next_action", "createNextActionBrief"],
  ["Prometheus, what matters right now", "tool", "daily_priorities", "createTopThreePriorities"],
  ["Prometheus, give me the rundown", "tool", "founder_rundown", "createFounderRundown"],
  ["Prometheus, what did we finish", "tool", "founder_rundown", "createFounderRundown"],
  ["Prometheus, what should I tell Chris", "tool", "founder_rundown", "createFounderRundown"],
  ["Prometheus, companion roadmap", "tool", "companion_roadmap", "createCompanionRoadmap"],
  ["Prometheus, Anthony feedback", "tool", "beta_feedback", "createBetaFeedbackReport"],
  ["Prometheus, check companion health", "tool", "companion_reliability", "createCompanionReliabilityReport"],
  ["Prometheus, end of day debrief", "tool", "end_of_day_debrief", "createEndOfDayDebrief"],
  ["Prometheus, what can you do", "tool", "command_inventory", "createCommandInventory"],
  ["Prometheus, Anthony", "clarification", "anthony_clarification", null],
  ["Prometheus, website", "clarification", "website_clarification", null],
  ["Prometheus, Chris", "clarification", "leadership_clarification", null]
];

let failed = 0;

for (const [phrase, expectedType, expectedIntent, expectedTool] of cases) {
  const routed = routeCommandIntent(phrase);
  const tool = routeCommandToTool(phrase);
  const ok = routed.type === expectedType && routed.intent === expectedIntent && tool === expectedTool;
  if (!ok) {
    failed += 1;
    console.error("FAIL", {
      phrase,
      expected: { type: expectedType, intent: expectedIntent, tool: expectedTool },
      actual: { type: routed.type, intent: routed.intent, tool }
    });
  } else {
    console.log("PASS", phrase, "=>", routed.intent, tool || "no tool");
  }
}

if (failed) {
  process.exitCode = 1;
}

const provider = new AIProvider();
const next = await provider.ask("Prometheus, what should I do next");
const followUp = await provider.ask("Why that?");
if (!/last answer|company leverage|Prometheus closer/i.test(followUp.body)) {
  failed += 1;
  console.error("FAIL follow-up memory", { next: next.body, followUp: followUp.body });
  process.exitCode = 1;
} else {
  console.log("PASS follow-up memory =>", followUp.title);
}
