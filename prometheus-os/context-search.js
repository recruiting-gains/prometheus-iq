import { searchContext } from "./project-context.js";
import { buildMemoryCorpus } from "./memory-retrieval.js";
import { normalizeText, rankMemoryItems } from "./memory-ranking.js";

const BLOCKED_CONTEXT_PATTERNS = [
  ".env",
  "api key",
  "token",
  "password",
  "secret",
  "credential"
];

function isSafeContextQuery(query = "") {
  const normalized = normalizeText(query);
  return !BLOCKED_CONTEXT_PATTERNS.some((pattern) => normalized.includes(pattern));
}

export function searchProjectContext(query = "", context = {}) {
  if (!isSafeContextQuery(query)) {
    return {
      mode: "blocked",
      reason: "Sensitive-context search was blocked by Prometheus Security Doctrine.",
      matches: []
    };
  }

  const safeProjectMatches = searchContext(query).slice(0, 3).map((match) => ({
    id: `project-${match.key}`,
    title: match.value?.title || match.key,
    summary: match.value?.summary || "",
    type: "project-context",
    source: "safe-project-context"
  }));
  const corpusMatches = rankMemoryItems(buildMemoryCorpus(), query, context).slice(0, 5);

  return {
    mode: "safe-local-context",
    matches: [...safeProjectMatches, ...corpusMatches]
  };
}
