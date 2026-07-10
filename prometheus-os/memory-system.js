import { companyState } from "./demo-data.js";

const today = "2026-07-10";

export const memoryEvents = [
  {
    id: "route-iq-patent-pending",
    date: "2026-07-09",
    title: "Route IQ Patent Pending status recorded",
    summary: "The Route IQ United States provisional patent application was filed and application 64/107,865 became the current governed patent record.",
    entities: ["Route IQ", "Patent", "Prometheus"],
    tags: ["route-iq", "patent", "governance"],
    status: "completed",
    impact: "Established the current Patent Pending status and invention-documentation obligation.",
    source: "PROMETHEUS_MASTER_ENGINEERING_STATE.md"
  },
  {
    id: "route-iq-operational",
    date: "2026-07-09",
    title: "Route IQ operational status recorded",
    summary: "Route IQ became the operational primary product and the current company and engineering focus.",
    entities: ["Route IQ", "Prometheus", "Overwatch"],
    tags: ["route-iq", "operations", "overwatch"],
    status: "completed",
    impact: "Moved the company into deployment readiness, customer onboarding, enterprise hardening, and continuous operational improvement.",
    source: "PROMETHEUS_MASTER_ENGINEERING_STATE.md"
  },
  {
    id: "aegis-phase-two-account-controls",
    date: "2026-07-09",
    title: "Aegis Phase II account control checkpoint recorded",
    summary: "Overwatch recorded account-level security completion and the remaining owner-controlled verification actions.",
    entities: ["Overwatch", "Cloudflare", "GitHub", "Route IQ"],
    tags: ["security", "enterprise-hardening", "overwatch"],
    status: "in-progress",
    impact: "Keeps account-owner security work visible during enterprise hardening.",
    source: "PROMETHEUS_MASTER_ENGINEERING_STATE.md"
  },
  {
    id: "crm-workspace-lead-persistence",
    date: "2026-07-10",
    title: "CRM workspace lead persistence added",
    summary: "Workspace-specific customer and lead continuity was strengthened for current onboarding operations.",
    entities: ["CRM", "Customer Onboarding", "Prometheus"],
    tags: ["crm", "customer-onboarding", "operations"],
    status: "completed",
    impact: "Preserves customer movement and handoff evidence across the Founder workflow.",
    source: "Git commit a5fd9fd"
  },
  {
    id: "nutrition-depot-executive-package",
    date: "2026-07-10",
    title: "Nutrition Depot executive package consumed",
    summary: "The current customer-onboarding operating package was synchronized into the governed platform record.",
    entities: ["Customer Onboarding", "Research", "Sales", "Prometheus"],
    tags: ["customer-onboarding", "research", "sales"],
    status: "completed",
    impact: "Supports the active Founder mission with current customer context.",
    source: "Git commit a1e7487"
  },
  {
    id: "companion-platform-state-sync",
    date: today,
    title: "Companion current platform state synchronization",
    summary: "Companion was reactivated by the Founder and synchronized to Route IQ operations, current product boundaries, current company phase, current Founder workflow, Overwatch state, and Patent Pending status.",
    entities: ["Prometheus Companion", "Route IQ", "Gaia", "Athena", "Overwatch", "Cruz"],
    tags: ["companion", "platform-state", "founder-os", "operations"],
    status: "in-progress",
    impact: "Prevents Founder decisions from relying on historical company assumptions.",
    source: "Platform State Knowledge Sync v1"
  }
];

const periodMatchers = [
  { period: "today", patterns: [/today/, /changed today/, /completed today/] },
  { period: "yesterday", patterns: [/yesterday/] },
  { period: "week", patterns: [/this week/, /weekly/, /week recap/] },
  { period: "unfinished", patterns: [/unfinished/, /remaining/, /still needs/, /blocked/] },
  { period: "since-login", patterns: [/since last login/, /since i logged in/, /since login/] }
];

export function inferTimelinePeriod(command = "") {
  const normalized = String(command).toLowerCase();
  return periodMatchers.find(({ patterns }) => patterns.some((pattern) => pattern.test(normalized)))?.period || "week";
}

export function getTimelineEvents({ period = "week", entity, tag } = {}) {
  let events = [...memoryEvents];

  if (period === "today" || period === "since-login") {
    events = events.filter((event) => event.date === today);
  } else if (period === "yesterday") {
    events = events.filter((event) => event.date === "2026-07-09");
  } else if (period === "unfinished") {
    events = events.filter((event) => event.status !== "completed");
  } else if (period === "week") {
    events = events.filter((event) => event.date >= "2026-07-03");
  }

  if (entity) {
    const needle = String(entity).toLowerCase();
    events = events.filter((event) => event.entities.some((name) => name.toLowerCase().includes(needle)));
  }

  if (tag) {
    const needle = String(tag).toLowerCase();
    events = events.filter((event) => event.tags.some((name) => name.toLowerCase() === needle));
  }

  return events.sort((a, b) => a.date.localeCompare(b.date));
}

export function searchMemory(query = "") {
  const needle = String(query).toLowerCase();
  return memoryEvents.filter((event) => {
    const haystack = [event.title, event.summary, event.impact, event.status, ...event.entities, ...event.tags].join(" ").toLowerCase();
    return haystack.includes(needle);
  });
}

function formatTimeline(events) {
  if (!events.length) return "I do not have a verified memory event for that yet.";
  return events.map((event) => `${event.date}: ${event.title}. ${event.summary}`).join(" ");
}

export function createTimelineAnswer(command = "") {
  const period = inferTimelinePeriod(command);
  const events = getTimelineEvents({ period });
  const periodLabel = {
    today: "Today",
    yesterday: "Yesterday",
    week: "This week",
    unfinished: "Unfinished work",
    "since-login": "Since last login"
  }[period];

  return {
    title: `${periodLabel} in Prometheus memory`,
    body: formatTimeline(events),
    events,
    period
  };
}

export function createEntityTimeline(entity) {
  const events = getTimelineEvents({ entity });
  return {
    title: `${entity} memory`,
    body: formatTimeline(events),
    events
  };
}

export function createUnfinishedWorkRecap() {
  const events = getTimelineEvents({ period: "unfinished" });
  return {
    title: "Unfinished Prometheus Work",
    body: [
      formatTimeline(events),
      "Founder rule: use the current Overwatch record, close verified operating gaps, and keep Route IQ stable."
    ].join(" ")
  };
}

export function createMemorySystemSummary() {
  return {
    title: "Prometheus Memory System",
    body: [
      `Prometheus has ${memoryEvents.length} current verified memory events across Route IQ operations, patent status, security, customer onboarding, CRM continuity, and Companion synchronization.`,
      "It can answer current timeline and entity questions about Route IQ, Gaia, Athena, Overwatch, CRM, customer onboarding, Website, GitHub, Cloudflare, and Companion.",
      "Memory remains local and curated from governed repository state."
    ].join(" ")
  };
}

export function getLatestMemoryEvent() {
  return [...memoryEvents].sort((a, b) => b.date.localeCompare(a.date))[0];
}

export function getBlockedMemoryEvents() {
  return memoryEvents.filter((event) => event.status === "blocked");
}

export function getCompanyMemoryStats() {
  return {
    totalEvents: memoryEvents.length,
    completed: memoryEvents.filter((event) => event.status === "completed").length,
    blocked: memoryEvents.filter((event) => event.status === "blocked").length,
    inProgress: memoryEvents.filter((event) => event.status === "in-progress").length,
    entities: Array.from(new Set(memoryEvents.flatMap((event) => event.entities))).sort(),
    tags: Array.from(new Set(memoryEvents.flatMap((event) => event.tags))).sort(),
    assistant: companyState.assistantName
  };
}
