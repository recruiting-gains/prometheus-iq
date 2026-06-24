const commandClarifications = {
  email: {
    intent: "email_clarification",
    category: "email",
    title: "Email Assistant",
    body: "Do you want me to draft an email, review email setup, or prepare an outreach message?"
  },
  chris: {
    intent: "leadership_clarification",
    category: "leadership",
    title: "Chris Follow-Up",
    body: "Do you want talking points for Chris, a follow-up message, or the executive packet summary?"
  },
  website: {
    intent: "website_clarification",
    category: "website",
    title: "Website",
    body: "Do you want website status, website edits, deployment guidance, or social media link wording?"
  },
  anthony: {
    intent: "anthony_clarification",
    category: "beta",
    title: "Anthony Beta",
    body: "Do you want Anthony beta status, route notes, feedback questions, or the end-of-day review checklist?"
  },
  github: {
    intent: "github_clarification",
    category: "repository",
    title: "GitHub",
    body: "Do you want GitHub status, a backup checklist, a commit message draft, or a safe push review?"
  },
  backup: {
    intent: "backup_clarification",
    category: "repository",
    title: "Backup",
    body: "Do you want a GitHub backup checklist, a daily data export reminder, or a safe commit message draft?"
  },
  pilot: {
    intent: "pilot_clarification",
    category: "pilot",
    title: "Pilot",
    body: "Do you want pilot readiness, pilot risks, pilot success metrics, or the Chris leadership ask?"
  }
};

const toolRules = [
  {
    intent: "daily_brief",
    category: "chief_of_staff",
    toolName: "createDailyBrief",
    exact: ["todays brief", "today brief", "daily brief", "founder brief", "give me todays brief"],
    phrases: ["give me todays brief", "show todays brief", "read todays brief", "daily founder brief"]
  },
  {
    intent: "next_action",
    category: "chief_of_staff",
    toolName: "createNextActionBrief",
    exact: ["what should i do next", "next action", "highest roi task", "highest leverage task"],
    phrases: ["what should i do next", "what is my next action", "what is the highest roi task", "what is the highest leverage task", "tell me what to do next"]
  },
  {
    intent: "progress_log",
    category: "chief_of_staff",
    toolName: "createProgressLogEntry",
    exact: ["what changed today", "daily progress log", "update daily progress log"],
    phrases: ["what changed today", "update the daily progress log", "progress log"]
  },
  {
    intent: "founder_scorecard",
    category: "chief_of_staff",
    toolName: "createFounderScorecard",
    exact: ["founder scorecard", "scorecard"],
    phrases: ["show founder scorecard", "read founder scorecard", "how am i doing"]
  },
  {
    intent: "pilot_blockers",
    category: "pilot",
    toolName: "createPilotBlockerBrief",
    exact: ["what is blocking the pilot", "pilot blockers", "what blocks the pilot"],
    phrases: ["what is blocking the pilot", "what could block the pilot", "show pilot blockers", "pilot risks"]
  },
  {
    intent: "companion_progress",
    category: "chief_of_staff",
    toolName: "summarizeCompanionProgress",
    exact: ["companion progress", "prometheus companion progress"],
    phrases: ["summarize prometheus companion progress", "show companion progress", "what changed with companion"]
  },
  {
    intent: "github_backup",
    category: "repository",
    toolName: "createGithubBackupChecklist",
    exact: ["prepare github backup", "github backup", "backup checklist"],
    phrases: ["prepare github backup", "safe backup", "github backup checklist"]
  },
  {
    intent: "beta_feedback",
    category: "beta",
    toolName: "createBetaFeedbackReport",
    exact: ["beta feedback", "anthony feedback"],
    phrases: ["prepare beta feedback", "create beta feedback report", "anthony beta feedback", "capture beta feedback"]
  },
  {
    intent: "companion_roadmap",
    category: "chief_of_staff",
    toolName: "createCompanionRoadmap",
    exact: ["companion roadmap", "prometheus roadmap", "roadmap"],
    phrases: ["show companion roadmap", "show prometheus roadmap", "next 30 days", "next 90 days"]
  },
  {
    intent: "email_assistant",
    category: "email",
    toolName: "createEmailAssistantClarification",
    exact: ["draft an email", "write an email"],
    phrases: ["prepare an email", "draft email", "write email", "email to chris", "outreach email", "follow up email"]
  }
];

export function normalizeIntentText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[’‘']/g, "")
    .replace(/^(hey\s+prometheus|good\s+morning\s+prometheus|prometheus)[,\s]+/i, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scorePhrase(normalized, phrase) {
  const normalizedPhrase = normalizeIntentText(phrase);
  if (!normalized || !normalizedPhrase) return 0;
  if (normalized === normalizedPhrase) return 1;
  if (normalized.startsWith(`${normalizedPhrase} `) && normalizedPhrase.length >= 8) return 0.9;
  if (normalized.includes(normalizedPhrase) && normalizedPhrase.length >= 8) return 0.88;
  return 0;
}

export function getClarification(command) {
  const normalized = normalizeIntentText(command);
  const clarification = commandClarifications[normalized];
  if (!clarification) return null;
  return {
    type: "clarification",
    ...clarification,
    confidence: 0.35,
    reason: "single-word command is intentionally ambiguous"
  };
}

export function routeCommandIntent(command) {
  const normalized = normalizeIntentText(command);
  const clarification = getClarification(normalized);
  if (clarification) {
    return { ...clarification, normalized };
  }

  let best = {
    type: "unknown",
    intent: "unknown",
    category: "unknown",
    confidence: 0,
    reason: "no exact or high-confidence intent matched",
    normalized
  };

  for (const rule of toolRules) {
    for (const phrase of rule.exact || []) {
      const score = normalized === normalizeIntentText(phrase) ? 1 : 0;
      if (score > best.confidence) {
        best = {
          type: "tool",
          intent: rule.intent,
          category: rule.category,
          toolName: rule.toolName,
          confidence: score,
          reason: `exact command match: ${phrase}`,
          normalized
        };
      }
    }

    for (const phrase of rule.phrases || []) {
      const score = scorePhrase(normalized, phrase);
      if (score > best.confidence) {
        best = {
          type: "tool",
          intent: rule.intent,
          category: rule.category,
          toolName: rule.toolName,
          confidence: score,
          reason: `high-confidence phrase match: ${phrase}`,
          normalized
        };
      }
    }
  }

  return best;
}

export function matchNodeIntent(command, nodes, phrasesForNode) {
  const normalized = normalizeIntentText(command);
  if (!normalized || getClarification(normalized)) return null;

  let best = null;
  for (const node of nodes) {
    for (const phrase of phrasesForNode(node)) {
      const score = scorePhrase(normalized, phrase);
      if (!best || score > best.confidence) {
        best = {
          type: "node",
          node,
          nodeId: node.id,
          confidence: score,
          reason: score === 1 ? `exact node match: ${phrase}` : `node phrase match: ${phrase}`,
          normalized
        };
      }
    }
  }

  return best && best.confidence >= 0.82 ? best : null;
}
