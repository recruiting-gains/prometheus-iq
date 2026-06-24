import { resolveConversationContext } from "./context-resolver.js";

const maxTurns = 40;
const turns = [];

export function rememberConversationTurn({ input = "", response = {}, route = "" } = {}) {
  turns.unshift({
    input,
    responseTitle: response.title || "",
    responseBody: response.body || "",
    intent: response.metadata?.intent || response.metadata?.orchestratorIntent || "",
    entities: response.metadata?.entities || [],
    route,
    timestamp: new Date().toISOString()
  });
  turns.splice(maxTurns);
}

export function getConversationMemory() {
  return [...turns];
}

export function createConversationContext(query = "", providerHistory = []) {
  const mergedHistory = [
    ...providerHistory,
    ...turns.map((turn) => ({
      input: turn.input,
      response: {
        title: turn.responseTitle,
        body: turn.responseBody,
        metadata: {
          intent: turn.intent,
          entities: turn.entities
        }
      },
      timestamp: turn.timestamp
    }))
  ];

  const context = resolveConversationContext(query, mergedHistory);
  return {
    ...context,
    recentTurns: turns.slice(0, 6)
  };
}
