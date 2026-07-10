export const safeProjectContext = {
  operatingSystem: {
    summary: "Prometheus is the governed AI operating system for outside sales. Route IQ is operational and the company is executing deployment readiness, customer onboarding, enterprise hardening, and continuous operational improvement.",
    safeFiles: [
      "PROMETHEUS_MASTER_ENGINEERING_STATE.md",
      "PROMETHEUS_SYSTEM_MAP.md",
      "COMPANY_IDENTITY.md",
      "PRODUCT_VISION.md",
      "overwatch/reports/prometheus-architectural-evolution-report-v1.md"
    ]
  },
  company: {
    mission: "Make outside sales intelligent, directed, accountable, and compounding.",
    phase: ["Deployment readiness", "Customer onboarding", "Enterprise hardening", "Continuous operational improvement"]
  },
  products: {
    routeIq: "Operational, Patent Pending, and the primary product.",
    gaia: "Paused. Architecture foundation preserved; no active expansion.",
    athena: "Architecture only. Not an active runtime."
  },
  founder: {
    role: "Operator, mission commander, decision maker, workspace owner, and business development executor.",
    workflow: "Select the active workspace, set Today's Mission, review the Research dossier, call the highest-value prospects, update CRM after every call, use readiness assessment when warranted, hand off to JR only with evidence, review follow-ups, and write tomorrow's priorities."
  },
  overwatch: {
    summary: "Overwatch governs trusted platform state, subsystem ownership, workspace isolation, verification, and checkpoints."
  },
  website: {
    summary: "The public Prometheus website supports current Route IQ positioning and customer onboarding without exposing protected mechanics or customer data.",
    status: "Operational"
  },
  crm: {
    summary: "CRM preserves customer, candidate, stage, follow-up, readiness, and evidence-based handoff records. Companion does not create a parallel CRM."
  },
  companion: {
    summary: "Prometheus Companion is Cruz's reactivated, local Founder executive operating system. It consumes current governed state without owning other subsystem runtimes.",
    safeUse: "Use for Founder briefs, current-state summaries, reasoning, memory, and decision support."
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
        summary: "Prometheus Companion can safely reference current Route IQ status, product boundaries, company phase, Founder workflow, Overwatch state, and read-only subsystem summaries."
      }
    }
  ];
}
