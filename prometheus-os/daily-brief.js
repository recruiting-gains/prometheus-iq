import { companyState } from "./demo-data.js";
import { founderScorecardText, getCompanySignal } from "./founder-scorecard.js";

const today = "Wednesday, June 24, 2026";

export function createDailyBrief({ voiceLength = "short" } = {}) {
  const anthony = getCompanySignal("anthony");
  const website = getCompanySignal("website");
  const github = getCompanySignal("github");
  const cloudflare = getCompanySignal("cloudflare");
  const pilot = getCompanySignal("pilot");
  const social = getCompanySignal("social");
  const llc = getCompanySignal("llc");

  const brief = {
    date: today,
    prometheusStatus: "Prometheus OS is active as a private founder assistant. Prometheus IQ remains separate from the public website and Anthony beta.",
    highestRoiTask: "Protect the beta signal: collect real rep feedback, confirm the route is actionable, and document where the workflow creates or removes friction.",
    biggestRisk: "The biggest company risk is mistaking internal progress for market proof before external pilot data proves adoption.",
    anthonyBetaStatus: `${anthony?.value || "Ready"}. ${anthony?.detail || ""}`,
    leadershipStatus: "Chris has the context for Dallas leadership. Keep follow-up simple: approval for a controlled 14-day pilot with three approved users.",
    websiteStatus: `${website?.value || "Live"}. ${website?.detail || ""}`,
    githubStatus: `${github?.value || "Active"}. Commits and pushes still require Cruz approval.`,
    cloudflareStatus: `${cloudflare?.value || "Deployed"}. Prometheus OS remains local-only.`,
    pilotReadinessStatus: `${pilot?.value || "High"}. ${pilot?.detail || ""}`,
    socialOpportunity: `${social?.value || "@prometheus.iq"}. Post founder progress and private pilot momentum without exposing internal technology.`,
    founderScorecard: founderScorecardText(),
    recommendedNextAction: "Run one clean validation loop: test the beta workflow, capture feedback, update the daily log, then prepare a GitHub backup only after reviewing changed files and confirming no secrets."
  };

  if (voiceLength === "long") return brief;

  return {
    title: "Daily Founder Brief",
    body: [
      "Hey Boss, here’s today’s brief.",
      "Anthony beta is ready.",
      "Website is online.",
      "Cloudflare is deployed.",
      "GitHub is active, but commit and push still need your approval.",
      `Pilot readiness is ${pilot?.value?.toLowerCase() || "high"}.`,
      `${llc?.label || "LLC setup"} remains ${llc?.value?.toLowerCase() || "pending"}.`,
      `Highest ROI task: ${brief.highestRoiTask}`,
      `Biggest risk: ${brief.biggestRisk}`,
      "Founder rule: validation beats new features today.",
      `Recommended focus: ${brief.recommendedNextAction}`
    ].join(" ")
  };
}

export function createDailyBriefMarkdown() {
  const brief = createDailyBrief({ voiceLength: "long" });
  return `# Prometheus Daily Founder Brief - ${brief.date}

## Today's Prometheus Status
${brief.prometheusStatus}

## Highest ROI Task
${brief.highestRoiTask}

## Biggest Company Risk
${brief.biggestRisk}

## Anthony Beta Status
${brief.anthonyBetaStatus}

## Chris / Leadership Follow-Up Status
${brief.leadershipStatus}

## Website Status
${brief.websiteStatus}

## GitHub / Backup Status
${brief.githubStatus}

## Cloudflare Status
${brief.cloudflareStatus}

## Pilot Readiness Status
${brief.pilotReadinessStatus}

## Social Media Opportunity
${brief.socialOpportunity}

## Founder Scorecard
${brief.founderScorecard}

## Recommended Next Action
${brief.recommendedNextAction}
`;
}
