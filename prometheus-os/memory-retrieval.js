import { companyState } from "./demo-data.js";
import { decisionTasks, rankDecisionTasks } from "./decision-engine.js";
import { dependencies, entities, relationships } from "./knowledge-graph.js";
import { getBlockedMemoryEvents, getTimelineEvents, memoryEvents } from "./memory-system.js";
import { inferMemoryIntent, normalizeText, rankMemoryItems } from "./memory-ranking.js";

const safeDocumentSources = [
  {
    id: "daily-progress-logs",
    title: "Daily Progress Logs",
    type: "document-source",
    summary: "Founder daily records that capture completed work, blockers, deployment status, and next actions.",
    tags: ["memory", "founder", "daily-log"],
    entities: ["Cruz", "Prometheus Companion"],
    status: "registered"
  },
  {
    id: "end-of-shift-reports",
    title: "End-of-shift Reports",
    type: "document-source",
    summary: "Engineering and operating reports summarizing what changed, what remains risky, and whether work is safe to commit.",
    tags: ["engineering", "backup", "report"],
    entities: ["Prometheus Companion", "GitHub"],
    status: "registered"
  },
  {
    id: "operating-system-documents",
    title: "Prometheus Operating System Documents",
    type: "document-source",
    summary: "Company operating documents covering pilot, pricing, LLC preparation, founder rhythm, executive materials, and company history.",
    tags: ["operations", "company", "documentation"],
    entities: ["Prometheus IQ", "Pilot", "Cruz"],
    status: "registered"
  },
  {
    id: "companion-reports",
    title: "Companion Reports",
    type: "document-source",
    summary: "Prometheus Companion engineering reports covering voice, intent routing, chief-of-staff systems, and memory architecture.",
    tags: ["companion", "voice", "memory"],
    entities: ["Prometheus Companion", "Prometheus OS"],
    status: "registered"
  }
];

function entityToMemoryItem([key, entity]) {
  return {
    id: `entity-${key}`,
    title: entity.label,
    type: "entity",
    summary: entity.summary,
    body: `Responsibilities: ${entity.responsibilities.join(", ")}.`,
    entities: [entity.label],
    tags: [entity.type, "knowledge-graph"],
    status: "known",
    source: "Prometheus Knowledge Graph"
  };
}

function relationshipToMemoryItem([from, relation, to], index) {
  const fromLabel = entities[from]?.label || from;
  const toLabel = entities[to]?.label || to;
  return {
    id: `relationship-${index}`,
    title: `${fromLabel} ${relation.replace(/-/g, " ")} ${toLabel}`,
    type: "relationship",
    summary: `${fromLabel} ${relation.replace(/-/g, " ")} ${toLabel}.`,
    entities: [fromLabel, toLabel],
    tags: ["knowledge-graph", "relationship"],
    status: "known",
    source: "Prometheus Knowledge Graph"
  };
}

function dependencyToMemoryItem([key, values]) {
  return {
    id: `dependency-${key}`,
    title: `${key} dependency chain`,
    type: "dependency",
    summary: `${key} depends on ${values.join(", ")}.`,
    entities: values,
    tags: ["dependency", "risk"],
    status: "known",
    source: "Prometheus Knowledge Graph"
  };
}

function taskToMemoryItem(task) {
  return {
    id: `decision-${task.id}`,
    title: task.title,
    type: "decision-task",
    summary: task.description,
    impact: task.reason,
    tags: ["priority", "decision-engine"],
    entities: ["Cruz", "Prometheus Companion"],
    status: "recommended",
    source: "Prometheus Decision Engine"
  };
}

function statusCardToMemoryItem(card) {
  return {
    id: `status-${card.key}`,
    title: `${card.label} status`,
    type: "status-card",
    summary: `${card.value}. ${card.detail}`,
    tags: ["status", card.signal],
    entities: [card.label],
    status: card.signal,
    source: "Prometheus OS Status Context"
  };
}

export function buildMemoryCorpus() {
  return [
    ...memoryEvents.map((event) => ({ ...event, type: "timeline-event" })),
    ...Object.entries(entities).map(entityToMemoryItem),
    ...relationships.map(relationshipToMemoryItem),
    ...Object.entries(dependencies).map(dependencyToMemoryItem),
    ...decisionTasks.map(taskToMemoryItem),
    ...companyState.statusCards.map(statusCardToMemoryItem),
    ...safeDocumentSources
  ];
}

function timelineForIntent(intent) {
  if (intent === "today_recap" || intent === "since_last_login") return getTimelineEvents({ period: "today" });
  if (intent === "yesterday_recap") return getTimelineEvents({ period: "yesterday" });
  if (intent === "weekly_recap") return getTimelineEvents({ period: "week" });
  if (intent === "risk") return getTimelineEvents({ period: "unfinished" });
  return [];
}

export function retrieveRelevantMemory(query = "", context = {}) {
  const intent = inferMemoryIntent(query);
  const corpus = buildMemoryCorpus();
  const ranked = rankMemoryItems(corpus, query, context);
  const timelineEvents = timelineForIntent(intent);
  const normalized = normalizeText(query);
  const matchingEntities = Object.entries(entities)
    .filter(([key, entity]) => normalized.includes(key) || normalized.includes(normalizeText(entity.label)))
    .map(([key, entity]) => ({ key, ...entity }));

  return {
    intent,
    query,
    context,
    ranked,
    top: ranked.slice(0, 8),
    timelineEvents,
    matchingEntities,
    rankedTasks: rankDecisionTasks(),
    blockers: getBlockedMemoryEvents(),
    sourceCoverage: {
      mode: "safe-local-memory",
      documents: safeDocumentSources.map((source) => source.title),
      limitation: "Prometheus Cognitive Engine v1 uses registered local memory and curated company context. It does not read .env files, secrets, live Meta, or live Google data."
    }
  };
}
