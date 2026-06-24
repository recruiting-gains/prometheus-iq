import { rankDecisionTasks } from "./decision-engine.js";
import { entities, relationships, dependencies } from "./knowledge-graph.js";
import { searchKnowledge } from "./knowledge-search.js";
import { retrieveRelevantMemory } from "./memory-retrieval.js";
import { getBlockedMemoryEvents, getTimelineEvents, memoryEvents } from "./memory-system.js";
import { normalizeText } from "./memory-ranking.js";
import { searchProjectContext } from "./context-search.js";

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
    truth: "verified",
    confidence: 0.85,
    ...overrides
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

function collectTimelineEvidence(query) {
  const period = questionPeriod(query);
  if (period === "month") {
    return memoryEvents.map((event) => evidenceFromMemoryItem(event, {
      type: "timeline-event",
      source: event.source || "Prometheus timeline"
    }));
  }
  if (!period) return [];
  return getTimelineEvents({ period }).map((event) => evidenceFromMemoryItem(event, {
    type: "timeline-event",
    source: event.source || "Prometheus timeline"
  }));
}

function collectEntityEvidence(query, context = {}) {
  const normalized = normalizeText([
    query,
    ...(context.focusEntities || [])
  ].filter(Boolean).join(" "));
  return Object.entries(entities)
    .filter(([key, entity]) => normalized.includes(key) || normalized.includes(normalizeText(entity.label)))
    .map(([key, entity]) => evidenceFromEntity(key, entity));
}

function collectKnowledgeEvidence(query, context = {}) {
  const knowledge = searchKnowledge(query, context);
  const entityEvidence = (knowledge.entities || []).map((entity) => evidenceFromEntity(entity.key, entity));
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
  }));
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
  }));
  return [...entityEvidence, ...relationshipEvidence, ...dependencyEvidence];
}

function collectDecisionEvidence() {
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
    score: task.score
  }));
}

function collectContextEvidence(query, context = {}) {
  const search = searchProjectContext(query, context);
  return (search.matches || []).map((item) => evidenceFromMemoryItem(item, {
    type: item.type || "safe-project-context",
    source: item.source || "Safe Project Context",
    truth: "verified",
    confidence: 0.72
  }));
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

export function retrieveEvidence(query = "", context = {}) {
  const memory = retrieveRelevantMemory(query, context);
  const memoryEvidence = [
    ...(memory.timelineEvents || []),
    ...(memory.top || [])
  ].map((item) => evidenceFromMemoryItem(item));

  const blockedEvidence = getBlockedMemoryEvents().map((event) => evidenceFromMemoryItem(event, {
    type: "blocked-event",
    tags: [...(event.tags || []), "blocker"],
    truth: "verified"
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
    confidence: 0.75
  }));

  const evidence = [
    ...collectTimelineEvidence(query),
    ...collectEntityEvidence(query, context),
    ...memoryEvidence,
    ...collectKnowledgeEvidence(query, context),
    ...collectDecisionEvidence(),
    ...blockedEvidence,
    ...dependencyEvidence,
    ...collectContextEvidence(query, context),
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
