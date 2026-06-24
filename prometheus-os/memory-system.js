import { companyState } from "./demo-data.js";

const today = "2026-06-24";

export const memoryEvents = [
  {
    id: "prometheus-contrarian-truth",
    date: "2026-06-18",
    title: "Contrarian truth sharpened",
    summary: "Cruz clarified that field sales and face-to-face activity have been overlooked while CRM and digital marketing systems grew.",
    entities: ["Cruz", "Prometheus IQ", "Pilot"],
    tags: ["founder", "strategy", "pitch"],
    status: "completed",
    impact: "Created the core investor narrative: Prometheus is not another CRM; it is field-sales intelligence before the lead is created.",
    source: "Founder pressure-test sessions"
  },
  {
    id: "cloudflare-private-app",
    date: "2026-06-20",
    title: "Prometheus IQ deployed and protected on Cloudflare",
    summary: "The working Prometheus IQ app was deployed through Cloudflare and protected with an additional login layer.",
    entities: ["Prometheus IQ", "Cloudflare", "Cruz"],
    tags: ["deployment", "security", "product"],
    status: "completed",
    impact: "Moved the app from local-only use to protected mobile access while keeping source code and data separate.",
    source: "Deployment work log"
  },
  {
    id: "gps-route-intelligence-live",
    date: "2026-06-21",
    title: "GPS pin-drop verification and Route Intelligence verified",
    summary: "GPS verification, Route Intelligence, rep/owner modes, production map, dashboards, import/export, and goal tracking were treated as live product capabilities.",
    entities: ["Prometheus IQ", "Route Intelligence", "Anthony", "Cruz"],
    tags: ["product", "gps", "route-intelligence", "pilot"],
    status: "completed",
    impact: "Created the product basis for a credible field-sales pilot: know where to go, verify activity, and learn from outcomes.",
    source: "Product readiness summaries"
  },
  {
    id: "executive-pilot-package",
    date: "2026-06-22",
    title: "Executive pilot materials built",
    summary: "Executive briefing, pilot approval package, success metrics, competitive differentiation, pricing strategy, execution playbook, and LLC launch planning were created.",
    entities: ["Chris", "Larry", "Phil", "Pilot", "Prometheus IQ"],
    tags: ["business", "pilot", "executive", "operations"],
    status: "completed",
    impact: "Turned Prometheus from a product experiment into a management-ready pilot proposal.",
    source: "Executive package and operating-system documents"
  },
  {
    id: "route-intelligence-v4-anthony",
    date: "2026-06-22",
    title: "Anthony route isolation and qualified prospect logic",
    summary: "Route Intelligence evolved to separate Cruz founder history from Anthony's new rep profile and prioritize qualified walk-in prospects over generic or restricted targets.",
    entities: ["Anthony", "Cruz", "Route Intelligence", "Prometheus IQ"],
    tags: ["product", "beta", "route-intelligence", "data"],
    status: "completed",
    impact: "Reduced the risk that Anthony sees Cruz-biased routes or non-actionable stops during beta testing.",
    source: "Route Intelligence v4.1 planning and beta work"
  },
  {
    id: "cinematic-public-website",
    date: "2026-06-23",
    title: "Cinematic public website and domain established",
    summary: "PrometheusRouteIQ.com became the public home for a cinematic 3D field-sales intelligence website with Request Pilot and View Demo experiences.",
    entities: ["Website", "Prometheus IQ", "Cloudflare", "Cruz"],
    tags: ["website", "brand", "public-presence"],
    status: "completed",
    impact: "Gave Prometheus a public-facing presence that can support social media, investor conversations, and pilot interest.",
    source: "Website build and domain work"
  },
  {
    id: "prometheus-companion-native",
    date: "2026-06-23",
    title: "Prometheus Companion native Mac assistant created",
    summary: "A native/local Companion experience was created with premium voice support, dock presence, manual launch behavior, and local-only founder assistant architecture.",
    entities: ["Prometheus Companion", "Prometheus OS", "Cruz"],
    tags: ["companion", "voice", "macos", "founder-os"],
    status: "completed",
    impact: "Shifted Prometheus from a web app into a private founder operating environment on Cruz's Mac.",
    source: "Companion engineering sessions"
  },
  {
    id: "daily-chief-of-staff",
    date: "2026-06-24",
    title: "Daily Chief of Staff layer added",
    summary: "Prometheus Companion gained daily brief, founder scorecard, priority engine, GitHub backup coach, email drafting mode, social media readiness, and safer intent routing.",
    entities: ["Prometheus Companion", "Prometheus OS", "GitHub", "Social Media"],
    tags: ["companion", "chief-of-staff", "routing", "operations"],
    status: "completed",
    impact: "Made Prometheus more useful as an operating partner instead of only a voice-enabled dashboard.",
    source: "Companion intelligence reports"
  },
  {
    id: "meta-instagram-blocked",
    date: "2026-06-24",
    title: "Meta / Instagram live integration paused",
    summary: "Meta Developer registration hit account-security and unexpected-error blockers, so social media live API setup was paused.",
    entities: ["Social Media", "Meta", "Instagram"],
    tags: ["blocked", "social", "external-dependency"],
    status: "blocked",
    impact: "Prometheus can keep manual social media tracking, but live Instagram metrics require Meta account access to clear first.",
    source: "Meta setup attempt"
  },
  {
    id: "memory-system-v1",
    date: today,
    title: "Prometheus Memory System v1 started",
    summary: "Local timeline, knowledge graph, decision engine, conversation context, Anthony memory, and Morning COO Brief v2 were added to Prometheus Companion.",
    entities: ["Prometheus Companion", "Prometheus OS", "Cruz", "Anthony"],
    tags: ["memory", "founder-os", "conversation", "decision-engine"],
    status: "in-progress",
    impact: "Moves Prometheus toward remembering company history and answering founder questions with context.",
    source: "Current 8-hour engineering mission"
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
    events = events.filter((event) => event.date === "2026-06-23");
  } else if (period === "unfinished") {
    events = events.filter((event) => event.status !== "completed");
  } else if (period === "week") {
    events = events.filter((event) => event.date >= "2026-06-18");
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
    const haystack = [
      event.title,
      event.summary,
      event.impact,
      event.status,
      ...event.entities,
      ...event.tags
    ].join(" ").toLowerCase();
    return haystack.includes(needle);
  });
}

function formatTimeline(events) {
  if (!events.length) return "I do not have a verified memory event for that yet.";
  return events
    .map((event) => `${event.date}: ${event.title}. ${event.summary}`)
    .join(" ");
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
  const blockers = events.filter((event) => event.status === "blocked");
  return {
    title: "Unfinished Prometheus work",
    body: [
      formatTimeline(events),
      blockers.length ? "Main blocker: " + blockers.map((event) => `${event.title}: ${event.impact}`).join(" ") : "",
      "Founder rule: keep blocked external integrations parked and move validation work forward."
    ].filter(Boolean).join(" ")
  };
}

export function createMemorySystemSummary() {
  return {
    title: "Prometheus Memory System v1",
    body: [
      `Prometheus now has ${memoryEvents.length} verified memory events across founder strategy, product, deployment, executive readiness, route intelligence, Companion work, and external blockers.`,
      "It can answer what happened today, yesterday, this week, what remains unfinished, and entity-specific questions about Anthony, Chris, the website, GitHub, Cloudflare, Route Intelligence, and the pilot.",
      "Current limitation: memory is local and curated from verified project context; it does not yet automatically ingest every future file change without an explicit update step."
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
