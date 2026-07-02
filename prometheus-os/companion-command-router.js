import { getClarification, matchNodeIntent, normalizeIntentText, routeCommandIntent } from "./intent-router.js";
import { shouldUseCognitiveEngine } from "./context-resolver.js?v=founder-regression-fix-20260702b";

const explicitNodeRequestPattern = /\b(open|display|pull up|bring up|configure)\b|\b(show|view)\b.*\b(card|node|dashboard|settings)\b/;

function routeDecision(type, overrides = {}) {
  const isCognitive = type === "cognitive";
  return {
    routeType: isCognitive ? "intelligence_orchestrator" : type,
    allowCards: !isCognitive,
    allowNodes: !isCognitive,
    allowTTSFromCards: !isCognitive,
    cancelPendingCardUpdates: isCognitive,
    ...overrides
  };
}

export function normalizeCompanionCommand(value = "") {
  return normalizeIntentText(value)
    .replace(/^(hey\s+prometheus|good\s+morning\s+prometheus|prometheus)\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function isExplicitNodeRequest(command = "") {
  const normalized = normalizeCompanionCommand(command);
  if (!normalized) return false;
  return explicitNodeRequestPattern.test(normalized);
}

export function shouldRouteToReasoning(command = "", history = []) {
  const normalized = normalizeCompanionCommand(command);
  if (!normalized) return false;
  return shouldUseCognitiveEngine(normalized, history);
}

export function resolveCompanionCommandRoute({
  command = "",
  history = [],
  skipNodeRouting = false,
  nodes = [],
  phrasesForNode = () => []
} = {}) {
  const normalized = normalizeCompanionCommand(command);
  const routedIntent = routeCommandIntent(normalized);
  const explicitNode = isExplicitNodeRequest(normalized);
  const matchedNode = !skipNodeRouting && explicitNode
    ? matchNodeIntent(normalized, nodes, phrasesForNode)
    : null;

  if (matchedNode) {
    return {
      type: "node",
      normalized,
      routedIntent,
      matchedNode,
      confidence: matchedNode.confidence,
      reason: `explicit node request: ${matchedNode.reason}`,
      decision: routeDecision("node")
    };
  }

  const shouldReason = shouldRouteToReasoning(normalized, history);

  if (shouldReason) {
    return {
      type: "cognitive",
      normalized,
      routedIntent,
      confidence: 1,
      reason: "founder reasoning question takes priority over cards, nodes, tools, and project-context fallback",
      decision: routeDecision("cognitive")
    };
  }

  const clarification = getClarification(normalized);
  if (clarification) {
    return {
      type: "clarification",
      normalized,
      routedIntent,
      clarification,
      confidence: clarification.confidence || 0.35,
      reason: clarification.reason || "ambiguous command needs clarification",
      decision: routeDecision("clarification")
    };
  }

  return {
    type: "provider",
    normalized,
    routedIntent,
    confidence: routedIntent.confidence || 0,
    reason: explicitNode
      ? "explicit node wording was present, but no safe node matched"
      : "no explicit node request; route to provider/reasoning instead of card fallback",
    decision: routeDecision("provider")
  };
}
