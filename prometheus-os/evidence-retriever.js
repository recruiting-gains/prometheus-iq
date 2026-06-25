import { rankDecisionTasks } from "./decision-engine.js";
import { companyState } from "./demo-data.js";
import { entities, relationships, dependencies } from "./knowledge-graph.js";
import { searchKnowledge } from "./knowledge-search.js";
import { retrieveRelevantMemory } from "./memory-retrieval.js";
import { getBlockedMemoryEvents, getTimelineEvents, memoryEvents } from "./memory-system.js";
import { normalizeText } from "./memory-ranking.js";
import { searchProjectContext } from "./context-search.js";

function classifyEvidenceTruth(item = {}, overrides = {}) {
  if (overrides.truth) return overrides.truth;
  if (item.truth) return item.truth;
  if (item.status === "unknown") return "unknown";
  if (item.status === "recommended") return "inferred";
  if (item.type === "document-source" || item.status === "registered") return "verified";
  if (item.type === "status-card") return "verified";
  return "verified";
}

function classifyEvidenceConfidence(item = {}, overrides = {}) {
  if (Number.isFinite(overrides.confidence)) return overrides.confidence;
  if (Number.isFinite(item.confidence)) return item.confidence;
  if (item.status === "unknown") return 1;
  if (item.status === "recommended") return 0.78;
  if (item.type === "document-source" || item.status === "registered") return 0.68;
  if (item.type === "status-card") return 0.72;
  return 0.85;
}

function includesAny(text = "", words = []) {
  return words.some((word) => text.includes(word));
}

function createKnowledgeSourcePlan(query = "", context = {}) {
  const normalized = normalizeText([
    query,
    context.lastInput,
    context.lastTitle,
    ...(context.focusEntities || [])
  ].filter(Boolean).join(" "));

  const sourceWeights = {
    timeline: 5,
    memory: 6,
    "company-state": 5,
    "knowledge-graph": 5,
    decision: 5,
    dependency: 5,
    "project-context": 3,
    truth: 6
  };

  const reasons = [];
  const timelineQuestion = includesAny(normalized, ["what happened", "what changed", "yesterday", "today", "this week", "last month", "timeline"]);
  const statusQuestion = includesAny(normalized, ["status", "ready", "readiness", "where are we", "rundown", "update", "current", "state"]);
  const decisionQuestion = includesAny(normalized, ["what should", "next", "highest roi", "what matters", "focus", "priority", "risk", "blocker", "coo"]);
  const executiveQuestion = includesAny(normalized, ["executive", "leadership", "chris", "larry", "phil", "dallas", "approval", "pilot"]);
  const entityQuestion = includesAny(normalized, ["anthony", "chris", "google places", "route intelligence", "website", "github", "cloudflare", "companion", "meta", "instagram"]);

  if (timelineQuestion) {
    sourceWeights.timeline = 10;
    sourceWeights.memory = 9;
    sourceWeights["project-context"] = 2;
    reasons.push("timeline/history question");
  }

  if (statusQuestion) {
    sourceWeights["company-state"] = 10;
    sourceWeights.memory = Math.max(sourceWeights.memory, 8);
    sourceWeights.dependency = Math.max(sourceWeights.dependency, 7);
    reasons.push("current company-state question");
  }

  if (decisionQuestion) {
    sourceWeights.decision = 10;
    sourceWeights.dependency = 9;
    sourceWeights.memory = Math.max(sourceWeights.memory, 8);
    sourceWeights["company-state"] = Math.max(sourceWeights["company-state"], 8);
    reasons.push("decision/recommendation question");
  }

  if (executiveQuestion) {
    sourceWeights["company-state"] = Math.max(sourceWeights["company-state"], 9);
    sourceWeights.memory = Math.max(sourceWeights.memory, 9);
    sourceWeights["knowledge-graph"] = Math.max(sourceWeights["knowledge-graph"], 8);
    reasons.push("executive/pilot readiness question");
  }

  if (entityQuestion) {
    sourceWeights["knowledge-graph"] = Math.max(sourceWeights["knowledge-graph"], 9);
    sourceWeights.memory = Math.max(sourceWeights.memory, 8);
    reasons.push("entity-specific question");
  }

  return {
    normalized,
    sourceWeights,
    reasons: reasons.length ? reasons : ["general founder question"]
  };
}

function sourceFit(plan, category) {
  return plan.sourceWeights[category] ?? 5;
}

function evidenceFromMemoryItem(item, overrides = {}) {
  return {
    id: item.id || item.key || item.title,
    title: item.title || item.label || item.key || "Prometheus memory",
    summary: item.summary || item.body || item.description || "",
    impact: item.impact || item.reason || "",
    date: item.date || "",
    type: item.type || "memory",
    source: item.source || "Prometheus local memory",
    tags: item.tags || [],
    entities: item.entities || [],
    status: item.status || "known",
    truth: classifyEvidenceTruth(item, overrides),
    confidence: classifyEvidenceConfidence(item, overrides),
    ...overrides
  };
}

function withSourcePlan(item, plan, category, reason) {
  return {
    ...item,
    sourceCategory: category,
    sourceFit: sourceFit(plan, category),
    sourceReason: reason || plan.reasons.join("; ")
  };
}

function evidenceFromEntity(key, entity) {
  const directRelationships = relationships
    .filter(([from, , to]) => from === key || to === key)
    .map(([from, relation, to]) => {
      const fromLabel = entities[from]?.label || from;
      const toLabel = entities[to]?.label || to;
      return `${fromLabel} ${relation.replace(/-/g, " ")} ${toLabel}`;
    });

  return {
    id: `entity-${key}`,
    title: `${entity.label} knowledge profile`,
    summary: `${entity.label} is a ${entity.type}. ${entity.summary}`,
    impact: directRelationships.length ? `Relationships: ${directRelationships.join("; ")}.` : "",
    type: "knowledge-graph-entity",
    source: "Prometheus Knowledge Graph",
    tags: ["knowledge-graph", entity.type],
    entities: [entity.label],
    status: "known",
    truth: "verified",
    confidence: 0.9
  };
}

function questionPeriod(query) {
  const normalized = normalizeText(query);
  if (normalized.includes("yesterday")) return "yesterday";
  if (normalized.includes("this week") || normalized.includes("week")) return "week";
  if (normalized.includes("today")) return "today";
  if (normalized.includes("last month") || normalized.includes("over the last month")) return "month";
  return "";
}

function collectTimelineEvidence(query, plan) {
  const period = questionPeriod(query);
  if (period === "month") {
    return memoryEvents.map((event) => withSourcePlan(evidenceFromMemoryItem(event, {
      type: "timeline-event",
      source: event.source || "Prometheus timeline"
    }), plan, "timeline", "timeline period match"));
  }
  if (!period) return [];
  return getTimelineEvents({ period }).map((event) => withSourcePlan(evidenceFromMemoryItem(event, {
    type: "timeline-event",
    source: event.source || "Prometheus timeline"
  }), plan, "timeline", "timeline period match"));
}

function collectEntityEvidence(query, context = {}, plan) {
  const normalized = normalizeText([
    query,
    ...(context.focusEntities || [])
  ].filter(Boolean).join(" "));
  return Object.entries(entities)
    .filter(([key, entity]) => normalized.includes(key) || normalized.includes(normalizeText(entity.label)))
    .map(([key, entity]) => withSourcePlan(evidenceFromEntity(key, entity), plan, "knowledge-graph", "direct entity match"));
}

function collectKnowledgeEvidence(query, context = {}, plan) {
  const knowledge = searchKnowledge(query, context);
  const entityEvidence = (knowledge.entities || []).map((entity) => withSourcePlan(evidenceFromEntity(entity.key, entity), plan, "knowledge-graph", "knowledge search entity match"));
  const relationshipEvidence = (knowledge.relationships || []).map((relationship, index) => ({
    id: `relationship-${index}-${normalizeText(relationship.title)}`,
    title: relationship.title,
    summary: relationship.summary,
    type: "knowledge-graph-relationship",
    source: "Prometheus Knowledge Graph",
    tags: ["relationship"],
    entities: [relationship.from, relationship.to],
    status: "known",
    truth: "verified",
    confidence: 0.8
  })).map((item) => withSourcePlan(item, plan, "knowledge-graph", "relationship evidence"));
  const dependencyEvidence = (knowledge.dependencies || []).map((dependency) => ({
    id: `dependency-${dependency.key}`,
    title: `${dependency.key} dependency`,
    summary: dependency.summary,
    type: "dependency",
    source: "Prometheus Knowledge Graph",
    tags: ["dependency", "risk"],
    entities: dependency.values || [],
    status: "known",
    truth: "verified",
    confidence: 0.82
  })).map((item) => withSourcePlan(item, plan, "dependency", "dependency evidence"));
  return [...entityEvidence, ...relationshipEvidence, ...dependencyEvidence];
}

function collectDecisionEvidence(plan) {
  return rankDecisionTasks().map((task) => ({
    id: `decision-${task.id}`,
    title: task.title,
    summary: task.description,
    impact: task.reason,
    type: "decision-engine-task",
    source: "Prometheus Decision Engine",
    tags: ["priority", "decision"],
    entities: ["Cruz", "Prometheus"],
    status: "recommended",
    truth: "inferred",
    confidence: 0.78,
    score: task.score,
    sourceCategory: "decision",
    sourceFit: sourceFit(plan, "decision"),
    sourceReason: "decision engine priority"
  }));
}

function collectContextEvidence(query, context = {}, plan) {
  const search = searchProjectContext(query, context);
  return (search.matches || []).map((item) => withSourcePlan(evidenceFromMemoryItem(item, {
    type: item.type || "safe-project-context",
    source: item.source || "Safe Project Context",
    truth: "verified",
    confidence: 0.72
  }), plan, "project-context", "safe project context match"));
}

function collectUnknownEvidence(query) {
  const normalized = normalizeText(query);
  if (normalized.includes("how many") && normalized.includes("anthony") && normalized.includes("visit")) {
    return [{
      id: "unknown-anthony-verified-visits-today",
      title: "Anthony verified visit count today",
      summary: "No verified Anthony visit count for today is available in local Prometheus memory.",
      impact: "Prometheus should not guess beta activity. Anthony needs logged visits or imported feedback before this can be answered as fact.",
      type: "unknown-operational-data",
      source: "Prometheus Truth Doctrine",
      tags: ["anthony", "beta", "unknown", "truth-doctrine"],
      entities: ["Anthony"],
      status: "unknown",
      truth: "unknown",
      confidence: 1
    }];
  }
  return [];
}

function collectCompanyStateEvidence(query, context = {}, plan) {
  const normalized = plan.normalized || normalizeText(query);
  const statusIntent = includesAny(normalized, ["status", "ready", "readiness", "where are we", "rundown", "update", "current", "state", "executive", "leadership", "pilot"]);
  if (!statusIntent) return [];

  const focusedKeys = new Set();
  for (const card of companyState.statusCards) {
    const key = normalizeText(card.key);
    const label = normalizeText(card.label);
    if (normalized.includes(key) || normalized.includes(label)) {
      focusedKeys.add(card.key);
    }
  }

  if (includesAny(normalized, ["executive", "leadership", "dallas", "larry", "phil", "approval"])) {
    ["executive", "pilot", "anthony", "github", "cloudflare", "llc", "domain"].forEach((key) => focusedKeys.add(key));
  }

  if (normalized.includes("chris")) {
    ["executive", "pilot", "anthony"].forEach((key) => focusedKeys.add(key));
  }

  if (normalized.includes("website") || normalized.includes("site")) {
    ["website", "domain", "cloudflare"].forEach((key) => focusedKeys.add(key));
  }

  if (normalized.includes("route intelligence") || normalized.includes("google places")) {
    ["route", "anthony", "pilot"].forEach((key) => focusedKeys.add(key));
  }

  const allowGeneralState = focusedKeys.size === 0 && includesAny(normalized, ["where are we", "rundown", "company status", "company update"]);

  return companyState.statusCards
    .filter((card) => {
      const haystack = normalizeText([card.key, card.label, card.value, card.signal, card.detail].join(" "));
      const directMatch = normalized.includes(normalizeText(card.key)) || normalized.includes(normalizeText(card.label));
      if (focusedKeys.size > 0) {
        return statusIntent && (focusedKeys.has(card.key) || directMatch);
      }

      return statusIntent &&
        (
          allowGeneralState ||
          directMatch ||
          haystack.split(" ").some((term) => term.length > 5 && normalized.includes(term))
        );
    })
    .map((card) => withSourcePlan({
      id: `company-state-${card.key}`,
      title: `${card.label} current company state`,
      summary: `${card.value}. ${card.detail}`,
      impact: card.signal === "pending"
        ? "This remains an open company-state item."
        : "This is part of the current local Companion company state.",
      type: "company-state",
      source: "Prometheus OS Company State",
      tags: ["company-state", "status", card.signal],
      entities: [card.label],
      status: card.signal,
      truth: "verified",
      confidence: 0.76
    }, plan, "company-state", "current status/readiness source"));
}

export function retrieveEvidence(query = "", context = {}) {
  const sourcePlan = createKnowledgeSourcePlan(query, context);
  const memory = retrieveRelevantMemory(query, context);
  const memoryEvidence = [
    ...(memory.timelineEvents || []),
    ...(memory.top || [])
  ].map((item) => withSourcePlan(evidenceFromMemoryItem(item), sourcePlan, "memory", "ranked local memory"));

  const blockedEvidence = getBlockedMemoryEvents().map((event) => evidenceFromMemoryItem(event, {
    type: "blocked-event",
    tags: [...(event.tags || []), "blocker"],
    truth: "verified",
    sourceCategory: "dependency",
    sourceFit: sourceFit(sourcePlan, "dependency"),
    sourceReason: "blocked memory event"
  }));

  const dependencyEvidence = Object.entries(dependencies).map(([key, values]) => ({
    id: `dependency-${key}`,
    title: `${key} dependency chain`,
    summary: `${key} depends on ${values.join(", ")}.`,
    type: "dependency",
    source: "Prometheus Knowledge Graph",
    tags: ["dependency", "risk"],
    entities: values,
    status: "known",
    truth: "verified",
    confidence: 0.75,
    sourceCategory: "dependency",
    sourceFit: sourceFit(sourcePlan, "dependency"),
    sourceReason: "dependency/risk source"
  }));

  const evidence = [
    ...collectTimelineEvidence(query, sourcePlan),
    ...collectCompanyStateEvidence(query, context, sourcePlan),
    ...collectEntityEvidence(query, context, sourcePlan),
    ...memoryEvidence,
    ...collectKnowledgeEvidence(query, context, sourcePlan),
    ...collectDecisionEvidence(sourcePlan),
    ...blockedEvidence,
    ...dependencyEvidence,
    ...collectContextEvidence(query, context, sourcePlan),
    ...collectUnknownEvidence(query)
  ];

  const seen = new Set();
  return evidence.filter((item) => {
    const key = item.id || `${item.title}-${item.source}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
