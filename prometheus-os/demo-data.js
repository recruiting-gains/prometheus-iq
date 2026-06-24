export const companyState = {
  generatedAt: "Wednesday, June 24, 2026",
  founder: "Cruz Garza",
  assistantName: "PROMETHEUS",
  mission: "Private founder-only AI operating system for Prometheus and Prometheus IQ.",
  statusCards: [
    {
      key: "website",
      label: "Website",
      value: "Live",
      signal: "online",
      detail: "PrometheusRouteIQ.com is live with cinematic 3D visuals, Request Pilot, and View Demo experiences."
    },
    {
      key: "anthony",
      label: "Anthony Beta",
      value: "Ready",
      signal: "ready",
      detail: "Anthony has a private rep-mode route package and Cloudflare-protected access path prepared."
    },
    {
      key: "route",
      label: "Route Intelligence",
      value: "v4.1 direction",
      signal: "ready",
      detail: "Qualified prospect filtering, rep-specific discovery, and walk-in ready routing are the current product direction."
    },
    {
      key: "github",
      label: "GitHub",
      value: "Active",
      signal: "online",
      detail: "Source code is backed up. Commits and pushes remain approval-level actions."
    },
    {
      key: "cloudflare",
      label: "Cloudflare",
      value: "Deployed",
      signal: "online",
      detail: "Public website and protected app are deployed. Prometheus OS is local-only and not deployed."
    },
    {
      key: "pilot",
      label: "Pilot Readiness",
      value: "High",
      signal: "ready",
      detail: "Leadership packet, pilot package, success metrics, and risk controls are prepared."
    },
    {
      key: "executive",
      label: "Executive Readiness",
      value: "Packet ready",
      signal: "ready",
      detail: "Chris, Larry, Phil, Dallas leadership, HR, legal, and operations have simplified sendable materials prepared."
    },
    {
      key: "llc",
      label: "LLC Progress",
      value: "Pending",
      signal: "pending",
      detail: "Texas LLC, EIN, business bank account, accounting, and insurance remain planned next business setup steps."
    },
    {
      key: "social",
      label: "Social Media",
      value: "@prometheus.iq",
      signal: "ready",
      detail: "Instagram is active. Keep content focused on founder journey, private pilot momentum, and field-sales lessons."
    },
    {
      key: "domain",
      label: "Domain / Email",
      value: "Operational",
      signal: "online",
      detail: "PrometheusRouteIQ.com and prometheusrouteiq@gmail.com are current public-facing brand assets."
    }
  ],
  priorities: [
    {
      title: "Protect beta stability",
      category: "Highest ROI",
      detail: "Do not add unnecessary product features before Anthony tests. Validate adoption, route clarity, visit logging, and export flow."
    },
    {
      title: "Prepare leadership follow-up",
      category: "Executive",
      detail: "Keep Chris follow-up simple: permission for controlled 14-day pilot, 3 approved users, clear safeguards, and final report."
    },
    {
      title: "Keep website conversion tight",
      category: "Website",
      detail: "Use the public site to create curiosity and pilot requests without exposing proprietary technology or internal logic."
    },
    {
      title: "Run nightly operating log",
      category: "Founder OS",
      detail: "Record product work, beta progress, outreach, security, founder training, and the next highest-leverage action."
    }
  ],
  chiefOfStaff: {
    highestRoiTask: "Collect and review real beta feedback before adding new features.",
    biggestRisk: "Building beyond the validation signal before external pilot data proves adoption.",
    recommendedNextAction: "Run the beta workflow, capture feedback, then prepare a clean GitHub backup after reviewing changed files.",
    githubRule: "Prometheus may prepare GitHub backup steps, but commit and push require Cruz approval."
  },
  links: [
    {
      label: "PrometheusRouteIQ.com",
      url: "https://prometheusrouteiq.com/"
    },
    {
      label: "Prometheus IQ App",
      url: "https://prometheus-iq.prometheusrouteiq.workers.dev/"
    },
    {
      label: "Anthony Beta",
      url: "https://prometheus-iq.prometheusrouteiq.workers.dev/?role=rep&rep=Anthony"
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
  founderSummary: `Act as the Prometheus COO. Summarize today's completed work, business progress, technical progress, risks, and the single highest-leverage next action. Keep it concise and executive-ready.`,
  dailyBrief: `Act as the Prometheus Daily Chief of Staff. Create today's founder brief with status, highest ROI task, biggest risk, Anthony beta, leadership follow-up, website, GitHub, Cloudflare, pilot readiness, social opportunity, founder scorecard, and recommended next action.`,
  progressLog: `Act as the Prometheus company historian. Summarize what changed today, files changed, product progress, website progress, companion progress, beta progress, business progress, deployment status, GitHub commit status, and next move.`,
  githubBackup: `Act as the Prometheus GitHub workflow engineer. Prepare a safe backup checklist that reviews changed files, secrets, .env ignores, Anthony beta, production app, tests, commit message, and explicit approval before commit or push.`,
  codexBuild: `Act as a senior product engineer for Prometheus IQ. Implement only the scoped change requested, preserve production behavior, run checks, avoid secrets, and report exactly what changed.`,
  betaFeedback: `Act as a pilot evaluator. Convert Anthony's daily feedback into bugs, adoption signals, route-quality notes, support needs, and next-day recommendations.`,
  chrisFollowUp: `Act as a COO. Draft a brief, professional follow-up to Chris that asks what Dallas leadership needs next while keeping Prometheus proprietary details protected.`
};
