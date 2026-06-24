import { dependencies, entities, relationships } from "./knowledge-graph.js";
import { normalizeText } from "./memory-ranking.js";

function relationshipSummary([from, relation, to]) {
  const fromLabel = entities[from]?.label || from;
  const toLabel = entities[to]?.label || to;
  return {
    from,
    to,
    relation,
    title: `${fromLabel} ${relation.replace(/-/g, " ")} ${toLabel}`,
    summary: `${fromLabel} ${relation.replace(/-/g, " ")} ${toLabel}.`
  };
}

export function searchKnowledge(query = "", context = {}) {
  const normalized = normalizeText([
    query,
    context.lastInput,
    ...(context.focusEntities || [])
  ].filter(Boolean).join(" "));

  const matchingEntities = Object.entries(entities)
    .filter(([key, entity]) => {
      const label = normalizeText(entity.label);
      const summary = normalizeText(entity.summary);
      return normalized.includes(key) || normalized.includes(label) || summary.split(" ").some((term) => term.length > 5 && normalized.includes(term));
    })
    .map(([key, entity]) => ({ key, ...entity }));

  const entityKeys = new Set(matchingEntities.map((entity) => entity.key));
  const matchingRelationships = relationships
    .filter(([from, , to]) => entityKeys.has(from) || entityKeys.has(to))
    .map(relationshipSummary);

  const matchingDependencies = Object.entries(dependencies)
    .filter(([key, values]) => normalized.includes(normalizeText(key)) || values.some((value) => normalized.includes(normalizeText(value))))
    .map(([key, values]) => ({ key, values, summary: `${key} depends on ${values.join(", ")}.` }));

  return {
    entities: matchingEntities,
    relationships: matchingRelationships,
    dependencies: matchingDependencies
  };
}
