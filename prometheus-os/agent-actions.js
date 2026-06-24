import { PermissionLevel, addAuditEntry } from "./audit-log.js";
import { companyState, promptTemplates } from "./demo-data.js";
import { safeProjectContext } from "./project-context.js";
import { createDailyBrief } from "./daily-brief.js";
import { createCompanionProgressSummary, createProgressLogSummary } from "./progress-log.js";
import { createGithubBackupChecklist, draftChiefOfStaffCommitMessage } from "./github-backup-checklist.js";
import { founderScorecardText } from "./founder-scorecard.js";
import { routeCommandIntent } from "./intent-router.js";

const blockedPatterns = [
  /delete\s+files?/i,
  /rm\s+-rf/i,
  /print\s+(api|secret|token|password|key)/i,
  /show\s+(api|secret|token|password|key)/i,
  /disable\s+security/i,
  /change\s+auth/i,
  /cloudflare\s+secret/i,
  /github\s+credential/i
];

const approvalPatterns = [
  /git\s+commit/i,
  /git\s+push/i,
  /deploy/i,
  /modify\s+anthony/i,
  /production/i,
  /cloudflare\s+(deploy|deployment|secret|settings|config|configuration|token)/i
];

function normalizeCommand(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[’‘']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export const agentTools = {
  createDailyBrief: {
    permissionLevel: PermissionLevel.READ_ONLY,
    run() {
      return createDailyBrief();
    }
  },
  createFounderScorecard: {
    permissionLevel: PermissionLevel.READ_ONLY,
    run() {
      return {
        title: "Founder Scorecard",
        body: founderScorecardText()
      };
    }
  },
  createNextActionBrief: {
    permissionLevel: PermissionLevel.READ_ONLY,
    run() {
      return {
        title: "Highest ROI task",
        body: "Protect the beta signal. Get Anthony through a clean test, capture where the workflow is confusing, verify the route feels actionable, and avoid new features until real usage proves what matters next."
      };
    }
  },
  summarizePrometheus: {
    permissionLevel: PermissionLevel.READ_ONLY,
    run() {
      return {
        title: "Prometheus summary",
        body: "Prometheus IQ has a live website, protected app, Anthony beta preparation, Route Intelligence direction, executive packet, pilot package, GitHub backup, and Cloudflare deployment. The highest-leverage move is pilot validation."
      };
    }
  },
  createPilotBlockerBrief: {
    permissionLevel: PermissionLevel.READ_ONLY,
    run() {
      return {
        title: "Pilot blockers",
        body: "The main pilot blockers are leadership approval, HR and legal comfort, stable Companion and app behavior, clear user consent, and proof that reps will use the workflow daily. The founder move is to reduce perceived risk and collect clean beta evidence."
      };
    }
  },
  createCompanionRoadmap: {
    permissionLevel: PermissionLevel.READ_ONLY,
    run() {
      return {
        title: "Prometheus roadmap",
        body: "Next 7 days: stabilize Companion voice, run Anthony beta validation, and keep GitHub backups clean. Next 30 days: convert pilot feedback into proof, refine Route Intelligence, and prepare leadership follow-up. Next 90 days: prove repeatable adoption, formalize LLC operations, and turn Prometheus from a working product into a company system."
      };
    }
  },
  checkGitStatus: {
    permissionLevel: PermissionLevel.SAFE_LOCAL_CHECK,
    run() {
      return {
        title: "Git status check",
        body: "Safe architecture note: the browser-only demo cannot run git directly. In a future backend, this tool will run `git status --short` server-side and redact sensitive paths."
      };
    }
  },
  runTests: {
    permissionLevel: PermissionLevel.SAFE_LOCAL_CHECK,
    run() {
      return {
        title: "Test runner",
        body: "Prepared local test action. Future backend will run syntax checks, app checks, and focused tests without deploying."
      };
    }
  },
  runBuild: {
    permissionLevel: PermissionLevel.SAFE_LOCAL_CHECK,
    run() {
      return {
        title: "Build runner",
        body: "Prepared build action. Future backend will run the app build locally and report pass/fail without changing production."
      };
    }
  },
  draftCommitMessage: {
    permissionLevel: PermissionLevel.PREPARE_ACTION,
    run() {
      return draftChiefOfStaffCommitMessage();
    }
  },
  createGithubBackupChecklist: {
    permissionLevel: PermissionLevel.PREPARE_ACTION,
    run() {
      return createGithubBackupChecklist();
    }
  },
  createEmailAssistantClarification: {
    permissionLevel: PermissionLevel.PREPARE_ACTION,
    run() {
      return {
        title: "Email Assistant",
        body: "Email support is not connected yet. I can still help draft an email, prepare an outreach message, or create a follow-up note. What would you like me to write?"
      };
    }
  },
  draftDeploymentChecklist: {
    permissionLevel: PermissionLevel.PREPARE_ACTION,
    run() {
      return {
        title: "Deployment checklist",
        body: "1. Confirm no secrets. 2. Confirm no public homepage link. 3. Require Cloudflare Access. 4. Test desktop/mobile. 5. Deploy only after explicit founder approval."
      };
    }
  },
  draftCodexPrompt: {
    permissionLevel: PermissionLevel.PREPARE_ACTION,
    run() {
      return {
        title: "Codex prompt",
        body: promptTemplates.codexBuild
      };
    }
  },
  createFounderSummary: {
    permissionLevel: PermissionLevel.PREPARE_ACTION,
    run() {
      return {
        title: "Founder summary",
        body: "Today, Prometheus advanced as a company system: website, pilot, beta, executive readiness, and private operating system are now connected by a founder command layer."
      };
    }
  },
  createProgressLogEntry: {
    permissionLevel: PermissionLevel.PREPARE_ACTION,
    run() {
      return createProgressLogSummary();
    }
  },
  summarizeCompanionProgress: {
    permissionLevel: PermissionLevel.READ_ONLY,
    run() {
      return createCompanionProgressSummary();
    }
  },
  createBetaFeedbackReport: {
    permissionLevel: PermissionLevel.PREPARE_ACTION,
    run() {
      return {
        title: "Beta feedback report",
        body: "Capture Anthony's route clarity, visit completion, GPS verification, logging friction, confusion points, and end-of-day export status."
      };
    }
  }
};

export function classifyPermission(command) {
  if (blockedPatterns.some((pattern) => pattern.test(command))) return PermissionLevel.BLOCKED;
  const looksLikePreparation = /(draft|prepare|checklist|plan|prompt|summary|report|message)/i.test(command);
  const looksProductionImpacting = approvalPatterns.some((pattern) => pattern.test(command));
  if (looksProductionImpacting && !looksLikePreparation) return PermissionLevel.APPROVAL_REQUIRED;
  if (/draft|create|prepare|write/i.test(command) || looksLikePreparation) return PermissionLevel.PREPARE_ACTION;
  if (/test|build|git status|check/i.test(command)) return PermissionLevel.SAFE_LOCAL_CHECK;
  if (looksProductionImpacting) return PermissionLevel.APPROVAL_REQUIRED;
  return PermissionLevel.READ_ONLY;
}

export function runAgentTool(toolName, command = "") {
  const tool = agentTools[toolName];
  if (!tool) {
    const permissionLevel = classifyPermission(command);
    const blocked = permissionLevel === PermissionLevel.BLOCKED;
    const approval = permissionLevel === PermissionLevel.APPROVAL_REQUIRED;
    const result = blocked
      ? "Blocked by Prometheus OS safety policy."
      : approval
        ? "Approval required. Prometheus OS will prepare a plan but will not execute this action."
        : "No exact tool matched. Prometheus OS will answer from safe project context.";
    addAuditEntry({ action: command || "unknown command", tool: "router", permissionLevel, approved: false, blocked, result });
    return {
      title: blocked ? "Action blocked" : approval ? "Approval required" : "Safe context response",
      body: result,
      permissionLevel
    };
  }

  const permissionLevel = tool.permissionLevel;
  if (permissionLevel >= PermissionLevel.APPROVAL_REQUIRED) {
    const result = "This action requires explicit approval and was not executed.";
    addAuditEntry({ action: command, tool: toolName, permissionLevel, approved: false, blocked: false, result });
    return { title: "Approval required", body: result, permissionLevel };
  }

  const output = tool.run({ companyState, safeProjectContext });
  addAuditEntry({ action: command || toolName, tool: toolName, permissionLevel, approved: true, blocked: false, result: output.body });
  return { ...output, permissionLevel };
}

export function routeCommandToTool(command) {
  const normalized = normalizeCommand(command);
  const routed = routeCommandIntent(normalized);
  if (routed.type === "tool" && routed.confidence >= 0.82) return routed.toolName;

  if (
    normalized.includes("todays brief") ||
    normalized.includes("daily brief") ||
    normalized.includes("give me today") ||
    normalized.includes("today brief") ||
    normalized.includes("founder brief")
  ) return "createDailyBrief";
  if (
    normalized.includes("what changed today") ||
    normalized.includes("daily progress log") ||
    normalized.includes("update the daily progress log") ||
    normalized.includes("update daily progress log") ||
    normalized.includes("progress log")
  ) return "createProgressLogEntry";
  if (
    normalized.includes("prepare github backup") ||
    normalized.includes("github backup") ||
    normalized.includes("backup checklist") ||
    normalized.includes("safe backup")
  ) return "createGithubBackupChecklist";
  if (normalized.includes("founder scorecard") || normalized.includes("scorecard")) return "createFounderScorecard";
  if (
    normalized === "what is blocking the pilot" ||
    normalized === "pilot blockers" ||
    normalized === "what blocks the pilot" ||
    normalized.includes("pilot risks")
  ) return "createPilotBlockerBrief";
  if (
    normalized === "what should i do next" ||
    normalized === "next action" ||
    normalized === "highest roi task" ||
    normalized === "highest leverage task"
  ) return "createNextActionBrief";
  if (
    normalized.includes("summarize prometheus companion progress") ||
    normalized.includes("companion progress") ||
    normalized.includes("prometheus companion progress")
  ) return "summarizeCompanionProgress";
  if (
    normalized === "companion roadmap" ||
    normalized === "prometheus roadmap" ||
    normalized === "roadmap" ||
    normalized.includes("next 30 days") ||
    normalized.includes("next 90 days")
  ) return "createCompanionRoadmap";
  if (
    normalized === "summarize prometheus" ||
    normalized === "prometheus summary" ||
    normalized === "company summary"
  ) return "summarizePrometheus";
  if (normalized.includes("git status") || normalized.includes("github status")) return "checkGitStatus";
  if (normalized.includes("run tests") || normalized.includes("test")) return "runTests";
  if (normalized.includes("run build") || normalized.includes("build")) return "runBuild";
  if (normalized.includes("commit message")) return "draftCommitMessage";
  if (normalized.includes("deployment checklist") || normalized.includes("deploy plan")) return "draftDeploymentChecklist";
  if (normalized.includes("codex prompt")) return "draftCodexPrompt";
  if (normalized.includes("founder summary")) return "createFounderSummary";
  if (normalized.includes("beta feedback")) return "createBetaFeedbackReport";
  if (normalized.includes("anthony feedback")) return "createBetaFeedbackReport";
  return null;
}
