import { createEntityTimeline } from "./memory-system.js";

export const entities = {
  cruz: {
    label: "Cruz",
    type: "Founder",
    summary: "Founder of Prometheus, builder of Prometheus IQ, and primary operator of Prometheus Companion.",
    responsibilities: ["vision", "pilot validation", "founder conversations", "customer discovery", "product decisions"]
  },
  anthony: {
    label: "Anthony",
    type: "Beta Tester",
    summary: "Coworker beta tester intended to validate a private rep-mode Prometheus IQ workflow.",
    responsibilities: ["test rep flow", "log visits", "provide feedback", "validate route quality"]
  },
  chris: {
    label: "Chris",
    type: "Leadership Contact",
    summary: "Houston Area Manager contact who may discuss Prometheus with Dallas leadership.",
    responsibilities: ["review concept", "route leadership interest", "clarify approval path"]
  },
  larry: {
    label: "Larry",
    type: "COO Persona / Executive Reviewer",
    summary: "COO-level approval lens used to pressure-test pilot readiness, risk controls, and operational value.",
    responsibilities: ["risk review", "pilot approval logic", "operations fit"]
  },
  phil: {
    label: "Phil",
    type: "President Persona / Executive Reviewer",
    summary: "President-level review lens used to evaluate business value, simplicity, and executive clarity.",
    responsibilities: ["strategic fit", "business impact", "leadership clarity"]
  },
  prometheusIq: {
    label: "Prometheus IQ",
    type: "Product",
    summary: "Field-sales intelligence platform that helps reps decide where to go, verify activity, log visits, and learn from outcomes.",
    responsibilities: ["route intelligence", "GPS verification", "visit logging", "manager visibility", "pilot data"]
  },
  companion: {
    label: "Prometheus Companion",
    type: "Private Founder Assistant",
    summary: "Native/local founder assistant and command center for Cruz, separate from customer-facing Prometheus IQ.",
    responsibilities: ["daily brief", "memory", "voice", "founder priorities", "backup coaching"]
  },
  cloudflare: {
    label: "Cloudflare",
    type: "Deployment / Protection",
    summary: "Hosting and protection layer for public website and protected app deployment.",
    responsibilities: ["public website", "protected app access", "deployment"]
  },
  github: {
    label: "GitHub",
    type: "Source Control",
    summary: "Repository backup and version-control system for Prometheus code and documentation.",
    responsibilities: ["source backup", "commit history", "restore path"]
  },
  website: {
    label: "Website",
    type: "Public Presence",
    summary: "PrometheusRouteIQ.com, the public-facing cinematic website for pilot interest and credibility.",
    responsibilities: ["brand", "request pilot", "demo", "social bio link"]
  },
  pilot: {
    label: "Pilot",
    type: "Validation System",
    summary: "Controlled field test structure designed to prove rep adoption, verified activity, route quality, and measurable outcomes.",
    responsibilities: ["validation", "success metrics", "feedback", "executive report"]
  },
  googlePlaces: {
    label: "Google Places",
    type: "Future Integration",
    summary: "Planned backend-only source for real business discovery and prospect qualification.",
    responsibilities: ["business discovery", "geocoding", "prospect refresh"]
  },
  routeIntelligence: {
    label: "Route Intelligence",
    type: "Product Intelligence Layer",
    summary: "Prometheus IQ's routing logic for qualified prospects, exploration, freshness, category diversity, and rep-specific learning.",
    responsibilities: ["recommendations", "freshness", "discovery", "rep-specific learning"]
  },
  socialMedia: {
    label: "Social Media",
    type: "Growth Channel",
    summary: "@prometheus.iq and founder build-in-public channel. Live Meta integration is paused due external account setup blockers.",
    responsibilities: ["visibility", "founder story", "pilot interest", "manual engagement"]
  }
};

export const relationships = [
  ["cruz", "founded", "prometheusIq"],
  ["cruz", "uses", "companion"],
  ["anthony", "tests", "prometheusIq"],
  ["anthony", "validates", "routeIntelligence"],
  ["chris", "can-introduce", "pilot"],
  ["pilot", "requires", "executive readiness"],
  ["larry", "reviews", "pilot"],
  ["phil", "reviews", "pilot"],
  ["prometheusIq", "depends-on", "routeIntelligence"],
  ["prometheusIq", "hosted-through", "cloudflare"],
  ["website", "hosted-through", "cloudflare"],
  ["github", "backs-up", "prometheusIq"],
  ["github", "backs-up", "companion"],
  ["googlePlaces", "can-improve", "routeIntelligence"],
  ["socialMedia", "supports", "website"],
  ["website", "supports", "pilot"],
  ["companion", "tracks", "pilot"],
  ["companion", "tracks", "github"],
  ["companion", "tracks", "cloudflare"]
];

export const dependencies = {
  pilotApproval: ["Chris leadership path", "risk controls", "user consent", "success metrics", "stable beta workflow"],
  anthonyBeta: ["private rep experience", "route quality", "GPS verification", "visit logging", "feedback loop"],
  routeIntelligence: ["qualified prospects", "rep-specific history", "freshness rules", "real-world outcomes"],
  publicGrowth: ["website", "Instagram/manual social", "founder clarity", "pilot proof"],
  companionReliability: ["local backend", "STT", "TTS", "intent router", "memory system", "manual launch"]
};

export function resolveEntityKey(command = "") {
  const normalized = String(command).toLowerCase();
  return Object.entries(entities).find(([key, entity]) => {
    const label = entity.label.toLowerCase();
    return normalized.includes(key.toLowerCase()) || normalized.includes(label);
  })?.[0] || null;
}

export function createEntityBrief(entityKey) {
  const entity = entities[entityKey];
  if (!entity) {
    return {
      title: "Unknown entity",
      body: "I do not have that entity in Prometheus memory yet."
    };
  }

  const directRelationships = relationships
    .filter(([from, , to]) => from === entityKey || to === entityKey)
    .map(([from, relation, to]) => `${entities[from]?.label || from} ${relation.replace(/-/g, " ")} ${entities[to]?.label || to}`);
  const timeline = createEntityTimeline(entity.label);

  return {
    title: `${entity.label} knowledge profile`,
    body: [
      `${entity.label} is a ${entity.type}.`,
      entity.summary,
      `Responsibilities: ${entity.responsibilities.join(", ")}.`,
      directRelationships.length ? `Relationships: ${directRelationships.join("; ")}.` : "",
      timeline.events?.length ? `Memory: ${timeline.body}` : ""
    ].filter(Boolean).join(" ")
  };
}

export function createKnowledgeGraphSummary(command = "") {
  const entityKey = resolveEntityKey(command);
  if (entityKey) return createEntityBrief(entityKey);

  return {
    title: "Prometheus Knowledge Graph",
    body: [
      `Prometheus currently tracks ${Object.keys(entities).length} core entities: ${Object.values(entities).map((entity) => entity.label).join(", ")}.`,
      `It understands ${relationships.length} relationships across founder, beta, product, deployment, leadership, social, and route-intelligence systems.`,
      "Most important dependency chain: Anthony beta validates Route Intelligence; Route Intelligence strengthens pilot proof; pilot proof improves leadership approval odds and future revenue."
    ].join(" ")
  };
}

export function createAnthonyMemoryProfile() {
  return {
    title: "Anthony Intelligence Profile",
    body: [
      "Anthony is the controlled beta tester profile, separate from Cruz founder history.",
      "Current beta status: ready.",
      "Route history: Anthony should use his own rep route package, not Cruz historical winners.",
      "Feedback history: Prometheus should capture bugs, UX issues, route quality issues, data issues, feature requests, and training issues.",
      "Discovery history: Anthony's route should prioritize fresh qualified storefronts and avoid generic plazas, big-box stores, restricted campuses, and Cruz-proven locations.",
      "Future recommendation rule: validate whether Anthony knows exactly where to walk first, who to ask for, and how quickly he can log the outcome."
    ].join(" ")
  };
}

export function createCompanionIntelligenceAudit() {
  return {
    title: "Companion Intelligence Audit",
    body: [
      "Missing memory: automatic ingestion from new daily logs is not live yet; memory is currently curated and local.",
      "Missing context: multi-turn conversation works in-session, but long-term conversational memory is not persisted as a database.",
      "Missing founder knowledge: LLC status, actual Anthony feedback, Chris follow-up outcome, and external pilot responses need future updates after they happen.",
      "Highest ROI improvement: connect daily progress logging to memory indexing so Prometheus updates its company timeline after every work session.",
      "Risk: adding integrations before pilot validation can create maintenance load without increasing approval odds."
    ].join(" ")
  };
}
