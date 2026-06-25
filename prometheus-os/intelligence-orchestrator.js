import { createConversationContext, rememberConversationTurn } from "./conversation-memory.js";
import { retrieveEvidence } from "./evidence-retriever.js";
import { rankEvidence } from "./evidence-ranker.js";
import { buildLlmContext } from "./llm-context-builder.js";
import { normalizeText } from "./memory-ranking.js";
import { runReasoningPipeline } from "./reasoning-pipeline.js";
import { shouldUseCognitiveEngine } from "./context-resolver.js";

const orchestratorPatterns = [
  /\bwhat happened\b/,
  /\bwhat changed\b/,
  /\bwhat major systems\b/,
  /\bsystems have been built\b/,
  /\blast month\b/,
  /\bthis week\b/,
  /\byesterday\b/,
  /\bwho is\b/,
  /\bwhy is\b/,
  /\bwhat is my biggest\b/,
  /\bbiggest risk\b/,
  /\bwhat should i do\b/,
  /\bwhat should we do\b/,
  /\bhighest roi\b/,
  /\bif you were my coo\b/,
  /\bwhat would you tell me\b/,
  /\bhow many businesses\b/,
  /\bwhat about\b/,
  /\bwhy\b/
];

function inferOrchestratorIntent(question = "") {
  const normalized = normalizeText(question);
  if (normalized.includes("how many") && normalized.includes("anthony") && normalized.includes("visit")) return "anthony_visit_count";
  if (normalized.includes("anthony")) return normalized.includes("why") ? "anthony_importance" : "anthony";
  if (
    normalized.includes("executive") ||
    normalized.includes("leadership") ||
    normalized.includes("larry") ||
    normalized.includes("phil") ||
    normalized.includes("dallas") ||
    normalized.includes("pilot approval") ||
    (normalized.includes("chris") && (normalized.includes("ready") || normalized.includes("readiness") || normalized.includes("status") || normalized.includes("tell") || normalized.includes("ask")))
  ) return "executive_readiness";
  if (normalized.includes("chris")) return "chris";
  if (normalized.includes("pilot readiness")) return "pilot_readiness";
  if (normalized.includes("google places") && normalized.includes("meta")) return "strategic_comparison";
  if (normalized.includes("google places")) return "google_places";
  if (normalized.includes("risk") || normalized.includes("blocker")) return "risk";
  if (normalized.includes("what should") || normalized.includes("highest roi") || normalized.includes("coo") || normalized.includes("tomorrow")) return "priority";
  if (normalized.includes("rundown") || normalized.includes("where are we") || normalized.includes("where we at")) return "company_rundown";
  if (normalized.includes("major systems")) return "major_systems";
  if (normalized.includes("week")) return "weekly_recap";
  if (normalized.includes("yesterday")) return "yesterday_recap";
  if (normalized.includes("today")) return "today_recap";
  if (normalized.includes("month")) return "month_recap";
  if (normalized.includes("daily brief") || normalized.includes("founder brief") || normalized.includes("brief")) return "founder_brief";
  return "founder_reasoning";
}

export class IntelligenceOrchestrator {
  shouldAnswer(question = "", history = []) {
    const normalized = normalizeText(question);
    if (!normalized) return false;
    if (shouldUseCognitiveEngine(normalized, history)) return true;
    return orchestratorPatterns.some((pattern) => pattern.test(normalized));
  }

  answer(question = "", history = []) {
    const context = createConversationContext(question, history);
    const intent = inferOrchestratorIntent(question);
    const evidence = retrieveEvidence(question, context);
    const rankedEvidence = rankEvidence(question, evidence, context);
    const llmContext = buildLlmContext({
      question,
      intent,
      context,
      evidence: rankedEvidence
    });
    const answer = runReasoningPipeline({
      question,
      context,
      rankedEvidence,
      llmContext
    });

    const enriched = {
      ...answer,
      metadata: {
        ...(answer.metadata || {}),
        orchestrator: true,
        orchestratorIntent: intent,
        evidenceCount: rankedEvidence.length,
        topEvidence: rankedEvidence.slice(0, 5).map((item) => ({
          title: item.title,
          truth: item.truth,
          source: item.source,
          score: item.evidenceScore
        })),
        llmContextBuilt: true,
        routeSelected: "intelligence_orchestrator"
      }
    };

    rememberConversationTurn({
      input: question,
      response: enriched,
      route: "intelligence_orchestrator"
    });

    return enriched;
  }
}

export const intelligenceOrchestrator = new IntelligenceOrchestrator();
