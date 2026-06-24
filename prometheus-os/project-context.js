export const safeProjectContext = {
  operatingSystem: {
    summary: "Prometheus has a structured operating system covering executive materials, pilot program, pricing, product, security, LLC/finance, marketing, customer success, founder rhythm, and future expansion.",
    safeFiles: [
      "PROMETHEUS OPERATING SYSTEM/PROMETHEUS_OPERATING_SYSTEM_README.md",
      "docs/prometheus-origin-story-development-history.md",
      "docs/prometheus-founder-operating-system.md",
      "docs/prometheus-pilot-execution-playbook.md"
    ]
  },
  originStory: {
    summary: "Prometheus started as a field-sales tool built from Cruz's direct experience. The contrarian truth is that face-to-face sales becomes more valuable as digital sales becomes more crowded.",
    safeUse: "Use for founder story, investor answers, website copy, and leadership context."
  },
  beta: {
    anthony: "Anthony beta is planned as a controlled rep-mode test with a fresh route, separate profile, verified visits, visit logging, feedback capture, and export/backup process.",
    support: "Pilot support should categorize bugs, collect daily feedback, and avoid new features during live beta unless critical."
  },
  website: {
    summary: "PrometheusRouteIQ.com is the public brand site. It communicates outcomes and pilot interest without exposing source code, proprietary scoring, prompts, or recommendation logic.",
    status: "Live"
  },
  executive: {
    summary: "Executive materials exist for Chris, Dallas leadership, COO, President, HR, legal, and operations review. The sendable packet is intentionally simplified.",
    safeUse: "Use for briefing, approval conversation, pilot request, risk controls, and success metrics."
  },
  googlePlaces: {
    summary: "Google Places integration is planned after beta. API keys must remain backend-only. It may improve qualified prospect discovery once secured and cost-monitored.",
    status: "Planned, not implemented."
  },
  blockedSources: [
    ".env",
    ".dev.vars",
    "secrets",
    "tokens",
    "credentials",
    "API keys",
    "private customer data",
    "private GPS logs",
    "protected auth configuration"
  ]
};

export function searchContext(query) {
  const normalized = query.toLowerCase();
  const matches = [];

  for (const [section, value] of Object.entries(safeProjectContext)) {
    const text = JSON.stringify(value).toLowerCase();
    if (text.includes(normalized) || normalized.includes(section.toLowerCase())) {
      matches.push({ section, value });
    }
  }

  if (matches.length) return matches;
  return [
    {
      section: "overview",
      value: {
        summary: "Prometheus OS can safely reference high-level project summaries, pilot status, website status, executive readiness, and founder operating priorities."
      }
    }
  ];
}
