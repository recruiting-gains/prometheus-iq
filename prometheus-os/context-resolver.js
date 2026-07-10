import { resolveEntityKey } from "./knowledge-graph.js";
import { inferMemoryIntent, normalizeText } from "./memory-ranking.js";

const operationalPatterns = [
  /\b(commit|push|deploy|delete|remove|send|archive|trash)\b/,
  /\bprepare github backup\b/,
  /\bdraft (an )?(email|message|commit)\b/,
  /\bupdate (the )?daily progress log\b/,
  /\bcreate (a )?(codex prompt|email|message)\b/
];

const cognitivePatterns = [
  /\bwhat happened\b/,
  /\bwhat changed\b/,
  /\bwhat major systems\b/,
  /\bmajor systems have been built\b/,
  /\bwhat changed in prometheus\b/,
  /\blast month\b/,
  /\bwhere are we\b/,
  /\bhow are we doing\b/,
  /\bhow are we looking\b/,
  /\bwhere do we stand\b/,
  /\bare we ready\b/,
  /\bready for leadership\b/,
  /\bready for dallas\b/,
  /\bgive me (the )?(rundown|brief)\b/,
  /\bdaily brief\b/,
  /\bfounder brief\b/,
  /\bwhat matters\b/,
  /\bwhat should i\b/,
  /\bwhat should we\b/,
  /\bwhat should i tell\b/,
  /\bwhat should i ask\b/,
  /\bhighest roi\b/,
  /\bbiggest (risk|blocker|opportunity)\b/,
  /\bwhat is falling behind\b/,
  /\bwhat\s*s slowing\b/,
  /\bwhats slowing\b/,
  /\bwhat is slowing\b/,
  /\bslowing prometheus down\b/,
  /\bbottleneck\b/,
  /\bfocus on\b/,
  /\bthis week\b/,
  /\byesterday\b/,
  /\btoday\b/,
  /\bsince last login\b/,
  /\bwhy\b/,
  /\bwho is\b/,
  /\bhow many businesses\b/,
  /\bif you were my coo\b/,
  /\bwhat would you tell me\b/,
  /\bmore important than meta\b/,
  /\bwhat about\b/,
  /\bhow does this affect\b/,
  /\bdeployment readiness\b/,
  /\bcustomer onboarding\b/,
  /\benterprise hardening\b/,
  /\bexecutive readiness\b/,
  /\bleadership readiness\b/,
  /\bleadership\b/,
  /\bexecutive\b/,
  /\bstatus of\b/
];

const topicPatterns = [
  /\broute iq\b/,
  /\bgaia\b/,
  /\bathena\b/,
  /\boverwatch\b/,
  /\bpatent\b/,
  /\bcustomer onboarding\b/,
  /\benterprise hardening\b/,
  /\bexecutive\b/,
  /\bwebsite\b/,
  /\bgithub\b/,
  /\bcloudflare\b/,
  /\bcompanion\b/,
  /\bmemory\b/,
  /\bcompany\b/
];

function getLastTurn(history = []) {
  return history.find((turn) => turn?.response?.body || turn?.response?.title) || null;
}

export function extractConversationSnapshot(history = []) {
  const lastTurn = getLastTurn(history);
  return {
    lastInput: lastTurn?.input || "",
    lastTitle: lastTurn?.response?.title || "",
    lastBody: lastTurn?.response?.body || "",
    lastTone: lastTurn?.response?.tone || "",
    lastCognitiveIntent: lastTurn?.response?.metadata?.intent || "",
    lastEntities: lastTurn?.response?.metadata?.entities || []
  };
}

export function resolveConversationContext(query = "", history = []) {
  const normalized = normalizeText(query);
  const snapshot = extractConversationSnapshot(history);
  const directEntity = resolveEntityKey(normalized);
  const inferredIntent = inferMemoryIntent(normalized);
  const isFollowUp = /^(why|what about|and what about|after that|what changed after that|how so|explain|break that down)\b/.test(normalized);
  const focusEntities = [
    directEntity,
    ...snapshot.lastEntities
  ].filter(Boolean);

  return {
    query,
    normalized,
    intent: inferredIntent,
    directEntity,
    isFollowUp,
    focusEntities: [...new Set(focusEntities)],
    ...snapshot
  };
}

export function shouldUseCognitiveEngine(command = "", history = []) {
  const normalized = normalizeText(command);
  if (!normalized) return false;
  if (operationalPatterns.some((pattern) => pattern.test(normalized))) return false;
  if (/^(email|website|github|backup|social media|instagram)$/.test(normalized)) return false;
  if (cognitivePatterns.some((pattern) => pattern.test(normalized))) return true;
  if (topicPatterns.some((pattern) => pattern.test(normalized)) && /\b(status|recap|summary|blocked|risk|ready|readiness|matter|next|focus|why|what|brief)\b/.test(normalized)) {
    return true;
  }
  if (history.length && /^(why|what about|and what about|after that|how so|explain)\b/.test(normalized)) {
    return true;
  }
  return false;
}
