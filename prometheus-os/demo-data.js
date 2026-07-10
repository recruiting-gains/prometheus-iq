const founderWorkflow = [
  "Select the active workspace in the Founder Workspace Switcher.",
  "Set Today's Mission and use the Mission Queue to establish the operating target.",
  "Open the Founder Intelligence Command Center and review the Research dossier.",
  "Start in the Dashboard and pull the prospect queue.",
  "Research only enough to make the next decision.",
  "Call the highest-value prospects first.",
  "Update the candidate stage after every call.",
  "Use the Franchise Readiness Assessment when interest warrants it.",
  "Hand off to JR only when the evidence supports the handoff.",
  "Review follow-ups and write tomorrow's priorities.",
  "Use Shared Workspace Lead Intake for new submissions and preserve candidates and leads through the CRM handoff contracts.",
  "Use Overwatch to determine which platform state and artifacts may be trusted."
];

export const companyState = {
  generatedAt: "Friday, July 10, 2026",
  founder: "Cruz Garza",
  assistantName: "PROMETHEUS",
  company: "Prometheus",
  mission: "Make outside sales intelligent, directed, accountable, and compounding.",
  platformDefinition: "Prometheus is the AI operating system for outside sales. It coordinates intelligence, field execution, customer operations, memory, and governance without becoming a generic CRM, route planner, or surveillance product.",
  products: {
    routeIq: {
      name: "Route IQ",
      status: "Operational",
      patentStatus: "Patent Pending",
      role: "Primary Product",
      detail: "Route IQ is the current operational product and the primary company and engineering focus."
    },
    gaia: {
      name: "Gaia",
      status: "Paused",
      role: "Research Orchestration",
      detail: "Gaia's architecture foundation is preserved, but active expansion is paused."
    },
    athena: {
      name: "Athena",
      status: "Architecture Only",
      role: "Future Intelligence Architecture",
      detail: "Athena currently exists as architecture and invention documentation, not an active runtime."
    }
  },
  patent: {
    product: "Route IQ",
    status: "Patent Pending",
    filing: "United States provisional patent application 64/107,865",
    detail: "Route IQ is covered by the filed provisional application. Material Route IQ invention changes must be documented in the patent workspace."
  },
  currentPhase: [
    "Deployment readiness",
    "Customer onboarding",
    "Enterprise hardening",
    "Continuous operational improvement"
  ],
  founderAlignment: {
    role: ["Operator", "Mission commander", "Decision maker", "Workspace owner", "Business development executor"],
    workflow: founderWorkflow
  },
  overwatch: {
    status: "Active governance",
    detail: "Overwatch is the platform governance and trust layer. It reconciles current engineering state, protects subsystem ownership and workspace isolation, and records verified checkpoints.",
    currentFocus: "Preserve Route IQ operations while completing deployment readiness, customer onboarding, enterprise hardening, and account-owner security controls."
  },
  statusCards: [
    {
      key: "route-iq",
      label: "Route IQ",
      value: "Operational",
      signal: "online",
      detail: "Patent Pending and the primary Prometheus product. Current work protects operations, readiness, onboarding, and hardening."
    },
    {
      key: "gaia",
      label: "Gaia",
      value: "Paused",
      signal: "pending",
      detail: "The architecture foundation is preserved. No active Gaia expansion is authorized."
    },
    {
      key: "athena",
      label: "Athena",
      value: "Architecture Only",
      signal: "pending",
      detail: "Athena is not an active product runtime."
    },
    {
      key: "company-phase",
      label: "Company Phase",
      value: "Operational Scale-Up",
      signal: "ready",
      detail: "Deployment readiness, customer onboarding, enterprise hardening, and continuous operational improvement."
    },
    {
      key: "overwatch",
      label: "Overwatch",
      value: "Active Governance",
      signal: "online",
      detail: "Canonical engineering state, subsystem boundaries, workspace isolation, and verified checkpoints remain governed."
    },
    {
      key: "patent",
      label: "Route IQ Patent",
      value: "Patent Pending",
      signal: "ready",
      detail: "United States provisional patent application 64/107,865 is filed."
    },
    {
      key: "companion",
      label: "Prometheus Companion",
      value: "Founder Reactivated",
      signal: "online",
      detail: "Companion is Cruz's private executive operating system and consumes current platform state without owning other subsystem runtimes."
    },
    {
      key: "website",
      label: "Website",
      value: "Operational",
      signal: "online",
      detail: "The public Prometheus presence supports current product positioning and customer onboarding."
    },
    {
      key: "github",
      label: "GitHub",
      value: "Active",
      signal: "online",
      detail: "Source control and checkpoint history remain part of the governed recovery path."
    },
    {
      key: "cloudflare",
      label: "Cloudflare",
      value: "Operational",
      signal: "online",
      detail: "Cloudflare supports current public and protected platform surfaces. Account-owner hardening actions remain governed separately."
    }
  ],
  priorities: [
    {
      title: "Complete deployment readiness",
      category: "Highest ROI",
      detail: "Close authenticated production verification and readiness evidence without destabilizing Route IQ."
    },
    {
      title: "Execute customer onboarding",
      category: "Founder Operations",
      detail: "Run the current Founder workflow from workspace selection through mission, research, calls, CRM stage updates, evidence-based handoff, and follow-up."
    },
    {
      title: "Finish enterprise hardening",
      category: "Security",
      detail: "Complete remaining account-owner security controls and preserve workspace isolation."
    },
    {
      title: "Improve operations continuously",
      category: "Route IQ",
      detail: "Treat Route IQ as operational: improve verified workflows, document material inventions, and avoid ungoverned expansion."
    }
  ],
  chiefOfStaff: {
    highestRoiTask: "Complete the next verified deployment-readiness or customer-onboarding action in the current Founder workflow.",
    biggestRisk: "Letting historical assumptions or unverified state drive decisions while Route IQ is already operational.",
    recommendedNextAction: "Select the active workspace, set Today's Mission, review the Research dossier, and execute the highest-value customer action with CRM and Overwatch evidence intact.",
    githubRule: "Use governed source-control and checkpoint practices; do not bypass subsystem ownership, verification, or security controls."
  },
  links: [
    {
      label: "PrometheusRouteIQ.com",
      url: "https://prometheusrouteiq.com/"
    },
    {
      label: "Route IQ",
      url: "https://prometheus-iq.prometheusrouteiq.workers.dev/"
    },
    {
      label: "Instagram",
      url: "https://www.instagram.com/prometheus.iq/"
    }
  ],
  voiceDefaults: {
    autoRead: true,
    preferredVoiceHints: ["male", "daniel", "alex", "google us english", "microsoft david", "english"]
  }
};

export const promptTemplates = {
  founderSummary: `Act as Prometheus Companion, Cruz Garza's private executive operating system. Summarize the current operational state, material changes, risks, and the single highest-leverage next action using current governed platform evidence.`,
  dailyBrief: `Create the current Founder brief. Cover Route IQ operations, deployment readiness, customer onboarding, enterprise hardening, continuous operational improvement, the active workspace mission, and the next action in the governed Founder workflow.`,
  progressLog: `Summarize current verified changes, Route IQ operations, customer onboarding, security hardening, Companion state, source-control status, and the next governed action.`,
  githubBackup: `Prepare a governed source-control checklist that reviews scope, changed files, secrets, tests, subsystem ownership, checkpoint state, commit intent, and push status.`,
  codexBuild: `Act as a senior Prometheus engineer. Implement only the scoped subsystem change, preserve operational Route IQ behavior, run checks, avoid secrets, and report exactly what changed.`,
  operatingFeedback: `Classify the supplied operational feedback as a defect, usability issue, data issue, workflow issue, support need, or improvement candidate without treating historical test phases as current company state.`,
  businessDevelopmentFollowUp: `Draft a brief professional business-development follow-up using current Route IQ operational status and the current customer-onboarding objective without exposing proprietary details.`
};
