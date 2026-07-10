import { createEntityTimeline } from "./memory-system.js";

export const entities = {
  cruz: {
    label: "Cruz",
    type: "Founder",
    summary: "Founder of Prometheus and the active operator, mission commander, decision maker, workspace owner, and business development executor.",
    responsibilities: ["company mission", "workspace selection", "customer execution", "product decisions", "governed handoffs"]
  },
  prometheus: {
    label: "Prometheus",
    type: "Company and Operating Platform",
    summary: "The AI operating system for outside sales, built to make field execution intelligent, directed, accountable, and compounding.",
    responsibilities: ["company operating state", "outside-sales intelligence", "subsystem coordination", "governance"]
  },
  routeIq: {
    label: "Route IQ",
    type: "Primary Product",
    summary: "The operational, Patent Pending primary Prometheus product and current engineering focus.",
    responsibilities: ["operational field intelligence", "directed execution", "verified workflows", "continuous improvement"]
  },
  gaia: {
    label: "Gaia",
    type: "Paused Product Architecture",
    summary: "The research-orchestration architecture foundation is preserved, but active Gaia expansion is paused.",
    responsibilities: ["preserved architecture", "future governed research orchestration"]
  },
  athena: {
    label: "Athena",
    type: "Architecture Only",
    summary: "Athena is future intelligence architecture and invention documentation, not an active runtime.",
    responsibilities: ["future architecture", "invention documentation"]
  },
  companion: {
    label: "Prometheus Companion",
    type: "Private Founder Assistant",
    summary: "Cruz's reactivated local executive operating system for current-state briefings, memory, voice, and decision support.",
    responsibilities: ["Founder brief", "current-state memory", "voice", "decision support", "read-only subsystem summaries"]
  },
  overwatch: {
    label: "Overwatch",
    type: "Governance and Trust Layer",
    summary: "The control plane for trusted engineering state, subsystem ownership, workspace isolation, verification, and checkpoints.",
    responsibilities: ["trusted state", "verification", "subsystem boundaries", "checkpoint governance"]
  },
  crm: {
    label: "CRM",
    type: "Customer Continuity System",
    summary: "The governed record for contacts, leads, candidates, stages, follow-ups, readiness, and evidence-based handoffs.",
    responsibilities: ["customer records", "stage continuity", "follow-up", "JR handoff evidence"]
  },
  research: {
    label: "Research",
    type: "Read-Only Intelligence Source",
    summary: "Research supplies verified strategic evidence and Founder dossiers without owning implementation.",
    responsibilities: ["evidence", "Founder dossier", "strategic analysis"]
  },
  sales: {
    label: "Sales",
    type: "Customer Onboarding Source",
    summary: "Sales supports discovery, qualification, next-step control, and current customer onboarding.",
    responsibilities: ["discovery", "qualification", "commercial next steps", "onboarding"]
  },
  website: {
    label: "Website",
    type: "Public Presence",
    summary: "The public Prometheus surface supporting Route IQ positioning and customer onboarding.",
    responsibilities: ["positioning", "credibility", "customer conversion"]
  },
  socialMedia: {
    label: "Social Media",
    type: "Read-Only Growth Source",
    summary: "Owns normalized Instagram analytics and content performance signals consumed by Companion.",
    responsibilities: ["normalized analytics", "content performance", "Founder marketing signals"]
  },
  cloudflare: {
    label: "Cloudflare",
    type: "Platform Delivery and Protection",
    summary: "Supports public and protected surfaces while account-owner hardening remains governed by Overwatch.",
    responsibilities: ["delivery", "protection", "account controls"]
  },
  github: {
    label: "GitHub",
    type: "Source Control",
    summary: "The governed source-control, recovery, and checkpoint trail for Prometheus.",
    responsibilities: ["source history", "recovery", "checkpoint traceability"]
  },
  patent: {
    label: "Route IQ Patent",
    type: "Patent Pending Invention Record",
    summary: "United States provisional patent application 64/107,865 is filed for Route IQ.",
    responsibilities: ["invention record", "material-change documentation"]
  },
  customerOnboarding: {
    label: "Customer Onboarding",
    type: "Current Company Phase",
    summary: "The active operating process from workspace mission through customer action, CRM continuity, readiness assessment, handoff, and follow-up.",
    responsibilities: ["mission execution", "customer calls", "CRM updates", "readiness", "handoff", "follow-up"]
  }
};

export const relationships = [
  ["cruz", "founded", "prometheus"],
  ["cruz", "operates", "companion"],
  ["cruz", "executes", "customerOnboarding"],
  ["prometheus", "operates", "routeIq"],
  ["prometheus", "governed-by", "overwatch"],
  ["routeIq", "protected-by", "patent"],
  ["gaia", "status", "paused"],
  ["athena", "status", "architecture only"],
  ["customerOnboarding", "recorded-in", "crm"],
  ["customerOnboarding", "uses", "research"],
  ["customerOnboarding", "uses", "sales"],
  ["website", "supports", "customerOnboarding"],
  ["socialMedia", "supports", "website"],
  ["routeIq", "delivered-through", "cloudflare"],
  ["github", "backs-up", "routeIq"],
  ["github", "backs-up", "companion"],
  ["companion", "reads", "overwatch"],
  ["companion", "summarizes", "crm"],
  ["companion", "summarizes", "research"],
  ["companion", "summarizes", "socialMedia"]
];

export const dependencies = {
  routeIqOperations: ["deployment readiness", "customer onboarding", "enterprise hardening", "continuous operational improvement"],
  customerOnboarding: ["active workspace", "Today's Mission", "Research dossier", "prospect queue", "CRM stage updates", "evidence-based handoff", "follow-up"],
  enterpriseHardening: ["authenticated verification", "account-owner controls", "workspace isolation", "Overwatch checkpoints"],
  patentContinuity: ["filed provisional application", "material invention documentation", "governed patent workspace"],
  companionReliability: ["local backend", "speech recognition", "premium voice", "intent routing", "current platform memory", "ESC"]
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
      title: "Unknown Entity",
      body: "I do not have that entity in current Prometheus memory."
    };
  }

  const directRelationships = relationships
    .filter(([from, , to]) => from === entityKey || to === entityKey)
    .map(([from, relation, to]) => `${entities[from]?.label || from} ${relation.replace(/-/g, " ")} ${entities[to]?.label || to}`);
  const timeline = createEntityTimeline(entity.label);

  return {
    title: `${entity.label} Knowledge Profile`,
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
      `Prometheus tracks ${Object.keys(entities).length} current entities: ${Object.values(entities).map((entity) => entity.label).join(", ")}.`,
      `It understands ${relationships.length} relationships across the Founder, Route IQ operations, governance, customer onboarding, intelligence, delivery, and memory.`,
      "Most important operating chain: the Founder sets the active mission, Research informs the next decision, Route IQ supports execution, CRM preserves the outcome, and Overwatch governs trusted state."
    ].join(" ")
  };
}

export function createCompanionIntelligenceAudit() {
  return {
    title: "Companion Intelligence Audit",
    body: [
      "Companion is synchronized to current Route IQ status, Patent Pending status, product boundaries, company phase, Founder workflow, and Overwatch governance.",
      "Memory remains local and curated from governed repository state.",
      "Highest-value maintenance action: refresh Companion whenever the master engineering state or Founder alignment changes."
    ].join(" ")
  };
}
