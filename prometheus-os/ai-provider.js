import { companyState, promptTemplates } from "./demo-data.js";
import { classifyPermission, routeCommandToTool, runAgentTool } from "./agent-actions.js";
import { PermissionLevel, addAuditEntry, permissionLabel } from "./audit-log.js";
import { getClarification, normalizeIntentText } from "./intent-router.js";
import { createFounderFollowUpResponse, createFounderRundown, isFounderConversationCommand, isFounderFollowUp } from "./founder-conversation.js";
import { createTopThreePriorities, createNextActionBrief } from "./daily-priority-engine.js";
import { createContextualFollowUpResponse, isContextualFollowUp } from "./conversation-context.js";
import { createKnowledgeGraphSummary, resolveEntityKey } from "./knowledge-graph.js";
import { createMemorySystemSummary, createTimelineAnswer, createUnfinishedWorkRecap } from "./memory-system.js";
import { cognitiveEngine } from "./cognitive-engine.js";
import { createFounderAssistantResponse } from "./founder-assistant.js";
import { FounderConversationEngine } from "./founder-conversation-engine.js?v=founder-regression-fix-20260702b";

export class AIProvider {
  constructor({ mode = "local-demo", communicationsService = null, socialMediaAnalyticsService = null, founderTimeline = null } = {}) {
    this.mode = mode;
    this.history = [];
    this.currentFocus = null;
    this.communicationsService = communicationsService;
    this.socialMediaAnalyticsService = socialMediaAnalyticsService;
    this.founderTimeline = founderTimeline;
    this.founderConversationEngine = new FounderConversationEngine({ founderTimeline });
  }

  get providerLabel() {
    if (this.mode === "openai") return "OpenAI backend ready";
    if (this.mode === "claude") return "Claude backend ready";
    return "Local demo intelligence";
  }

  setFounderTimeline(timeline) {
    this.founderTimeline = timeline || null;
    this.founderConversationEngine.setFounderTimeline(timeline);
  }

  async ask(message, { signal } = {}) {
    const cleanMessage = String(message || "").trim();
    const normalized = this.normalizeFounderCommand(cleanMessage);
    const permissionLevel = classifyPermission(normalized);

    if (signal?.aborted) return this.stoppedResponse();

    if (permissionLevel === PermissionLevel.BLOCKED) {
      addAuditEntry({
        action: cleanMessage,
        tool: "safety-router",
        permissionLevel,
        approved: false,
        blocked: true,
        result: "Blocked by Prometheus OS safety policy."
      });
      return this.remember(cleanMessage, {
        title: "Blocked for safety",
        body: "I cannot delete files, expose secrets, print credentials, disable security, change auth systems, or modify protected credentials.",
        permission: permissionLabel(permissionLevel),
        tone: "blocked"
      });
    }

    if (this.founderConversationEngine.shouldAnswer(normalized)) {
      return this.remember(cleanMessage, this.founderConversationEngine.answer(normalized, {
        history: this.history
      }));
    }

    if (signal?.aborted) return this.stoppedResponse();

    const founderAssistantResponse = await createFounderAssistantResponse(normalized, {
      communicationsService: this.communicationsService || undefined,
      socialMediaAnalyticsService: this.socialMediaAnalyticsService || undefined,
      founderTimeline: this.founderTimeline || undefined
    });
    if (founderAssistantResponse) {
      return this.remember(cleanMessage, founderAssistantResponse);
    }

    if (signal?.aborted) return this.stoppedResponse();

    if (cognitiveEngine.shouldAnswer(normalized, this.history)) {
      return this.remember(cleanMessage, cognitiveEngine.answer(cleanMessage, this.history));
    }

    const clarification = getClarification(normalized);
    if (clarification) {
      return this.remember(cleanMessage, {
        title: clarification.title,
        body: clarification.body,
        permission: "Level 0 - Read Only",
        tone: "clarification",
        metadata: {
          intent: clarification.intent,
          category: clarification.category
        }
      });
    }

    if (isContextualFollowUp(normalized)) {
      return this.remember(cleanMessage, createContextualFollowUpResponse(normalized, this.history[0]));
    }

    if (isFounderFollowUp(normalized)) {
      return this.remember(cleanMessage, createFounderFollowUpResponse(normalized, this.history[0]));
    }

    const toolName = routeCommandToTool(normalized);
    if (toolName) {
      const output = runAgentTool(toolName, cleanMessage);
      return this.remember(cleanMessage, {
        title: output.title,
        body: output.body,
        permission: permissionLabel(output.permissionLevel),
        tone: "tool"
      });
    }

    if (permissionLevel === PermissionLevel.APPROVAL_REQUIRED) {
      addAuditEntry({
        action: cleanMessage,
        tool: "approval-router",
        permissionLevel,
        approved: false,
        blocked: false,
        result: "Approval required. Action was not executed."
      });
      return this.remember(cleanMessage, {
        title: "Approval required",
        body: "That action may affect production, deployment, GitHub history, Cloudflare, or Anthony's beta. I can draft a checklist, but I will not execute it without explicit approval.",
        permission: permissionLabel(permissionLevel),
        tone: "approval"
      });
    }

    const response = await this.localAnswer(normalized);
    return this.remember(cleanMessage, response);
  }

  stoppedResponse() {
    return {
      title: "Stopped",
      body: "Stopped.",
      permission: "Level 0 - Read Only",
      tone: "voice_interrupt",
      metadata: {
        routeSelected: "voice_interrupt",
        cardFallbackUsed: false,
        showCard: false
      }
    };
  }

  normalizeFounderCommand(message) {
    return String(message || "")
      .toLowerCase()
      .replace(/[’‘']/g, "")
      .replace(/^(hey\s+prometheus|good\s+morning\s+prometheus|prometheus)[,\s]+/i, "")
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  remember(input, response) {
    this.currentFocus = response?.title || this.currentFocus;
    this.founderConversationEngine.remember(input, response);
    this.history.unshift({
      input,
      response,
      timestamp: new Date().toISOString()
    });
    this.history = this.history.slice(0, 30);
    return response;
  }

  async localAnswer(command) {
    if (!command) {
      return {
        title: "PROMETHEUS standing by",
        body: "Ask me what to do next, what changed today, what is blocking the pilot, Anthony beta status, website status, GitHub status, Cloudflare status, Chris follow-up, Instagram, Codex prompts, or founder summaries.",
        permission: "Level 0 - Read Only",
        tone: "idle"
      };
    }

    if (this.founderConversationEngine.shouldAnswer(command)) {
      return this.founderConversationEngine.answer(command, {
        history: this.history
      });
    }

    const founderAssistantResponse = await createFounderAssistantResponse(command, {
      communicationsService: this.communicationsService || undefined,
      socialMediaAnalyticsService: this.socialMediaAnalyticsService || undefined,
      founderTimeline: this.founderTimeline || undefined
    });
    if (founderAssistantResponse) return founderAssistantResponse;

    if (cognitiveEngine.shouldAnswer(command, this.history)) {
      return cognitiveEngine.answer(command, this.history);
    }

    const clarification = getClarification(command);
    if (clarification) {
      return {
        title: clarification.title,
        body: clarification.body,
        permission: "Level 0 - Read Only",
        tone: "clarification"
      };
    }

    const normalizedCommand = normalizeIntentText(command);
    const matchedSystem = companyState.statusCards.find((card) => {
      const label = normalizeIntentText(card.label);
      const key = normalizeIntentText(card.key);
      return normalizedCommand === label ||
        normalizedCommand === key ||
        normalizedCommand === `${label} status` ||
        normalizedCommand === `review ${label} status`;
    });
    if (matchedSystem) {
      return {
        title: `${matchedSystem.label} status`,
        body: `${matchedSystem.value}. ${matchedSystem.detail}`,
        permission: "Level 0 - Read Only",
        tone: matchedSystem.signal
      };
    }

    if (command.includes("next") || command.includes("highest roi") || command.includes("highest leverage")) {
      return {
        ...createNextActionBrief(),
        permission: "Level 0 - Read Only",
        tone: "priority"
      };
    }

    if (command.includes("top 3") || command.includes("top three") || command.includes("priorities") || command.includes("what matters right now")) {
      return {
        ...createTopThreePriorities(),
        permission: "Level 0 - Read Only",
        tone: "priority"
      };
    }

    if (isFounderConversationCommand(command)) {
      return {
        ...createFounderRundown(command),
        permission: "Level 0 - Read Only",
        tone: "chief-of-staff"
      };
    }

    if (/\banthony\s+beta\b/.test(command) || /\banthony\s+status\b/.test(command)) {
      return {
        title: "Anthony beta status",
        body: "Anthony's beta path is ready for controlled use. He should see his own rep experience, not Cruz's history. Watch route clarity, GPS verification, visit logging, feedback, and export completion.",
        permission: "Level 0 - Read Only",
        tone: "beta"
      };
    }

    if (/\bwebsite\s+status\b/.test(command) || /\bsite\s+status\b/.test(command)) {
      return {
        title: "Website status",
        body: "PrometheusRouteIQ.com is live. The website should create curiosity, explain outcomes, and drive pilot requests without exposing proprietary logic.",
        permission: "Level 0 - Read Only",
        tone: "website"
      };
    }

    if (command.includes("cloudflare")) {
      return {
        title: "Cloudflare status",
        body: "Cloudflare is live for the public website and protected app. Prometheus OS remains local-only. If deployed later, it must be behind Cloudflare Access.",
        permission: "Level 0 - Read Only",
        tone: "deployment"
      };
    }

    if (/\bgithub\s+status\b/.test(command) || /\bgit\s+status\b/.test(command)) {
      return {
        title: "GitHub status",
        body: "GitHub is active as the source-code backup. Commits and pushes are approval-level actions. Continue avoiding ZIP files, temp files, secrets, tokens, and generated clutter.",
        permission: "Level 0 - Read Only",
        tone: "repo"
      };
    }

    if (/\bpilot\s+readiness\b/.test(command) || command.includes("blocking")) {
      return {
        title: "Pilot blockers",
        body: "The main blockers are leadership approval, HR/legal comfort, clean user consent, stable beta behavior, and proving reps will actually use the workflow daily.",
        permission: "Level 0 - Read Only",
        tone: "pilot"
      };
    }

    if (command.includes("chris") || command.includes("larry") || command.includes("phil")) {
      return {
        title: "Leadership follow-up",
        body: "Ask what Dallas leadership needs to feel comfortable approving a controlled 14-day pilot. Keep the ask simple: 3 approved users, GPS verification, weekly review, final report, and no proprietary details disclosed.",
        permission: "Level 0 - Read Only",
        tone: "executive"
      };
    }

    if (command.includes("instagram") || command.includes("social")) {
      return {
        title: "Instagram guidance",
        body: "Post the founder journey, private pilot progress, and field-sales lessons. Create curiosity without showing internal screens, route logic, scoring methods, or customer-sensitive details.",
        permission: "Level 0 - Read Only",
        tone: "social"
      };
    }

    if (command.includes("codex prompt")) {
      return {
        title: "Codex prompt",
        body: promptTemplates.codexBuild,
        permission: "Level 2 - Prepare Action",
        tone: "prompt"
      };
    }

    if (command.includes("memory system") || command.includes("company memory")) {
      return {
        ...createMemorySystemSummary(),
        permission: "Level 0 - Read Only",
        tone: "memory"
      };
    }

    if (command.includes("what happened") || command.includes("yesterday") || command.includes("this week") || command.includes("since last login")) {
      return {
        ...createTimelineAnswer(command),
        permission: "Level 0 - Read Only",
        tone: "memory"
      };
    }

    if (command.includes("unfinished") || command.includes("what remains") || command.includes("still needs work")) {
      return {
        ...createUnfinishedWorkRecap(),
        permission: "Level 0 - Read Only",
        tone: "memory"
      };
    }

    if (command.includes("knowledge graph") || command.includes("relationship map") || command.includes("dependency map")) {
      return {
        ...createKnowledgeGraphSummary(command),
        permission: "Level 0 - Read Only",
        tone: "memory"
      };
    }

    const entityKey = resolveEntityKey(command);
    if (entityKey && command.includes("memory")) {
      return {
        ...createKnowledgeGraphSummary(command),
        permission: "Level 0 - Read Only",
        tone: "memory"
      };
    }

    return {
      title: "Founder Conversation",
      body: [
        "My best read is to keep this tied to validation, beta proof, revenue path, or risk reduction.",
        "When the available data is thin, the founder move is still clear: choose the action that creates proof instead of polish.",
        "Recommendation: capture one useful signal, then decide whether the next block belongs to engineering, sales, or follow-up."
      ].join(" "),
      permission: "Level 0 - Read Only",
      tone: "founder-conversation",
      metadata: {
        founderAssistant: true,
        routeSelected: "founder_conversation",
        cardFallbackUsed: false,
        intent: "founder_conversation_fallback"
      }
    };
  }
}

export const aiProvider = new AIProvider({ mode: "local-demo" });
