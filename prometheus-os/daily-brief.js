import { companyState } from "./demo-data.js";
import { founderScorecardText, getCompanySignal } from "./founder-scorecard.js";

export function createDailyBrief({ voiceLength = "short" } = {}) {
  const routeIq = getCompanySignal("route-iq");
  const phase = getCompanySignal("company-phase");
  const overwatch = getCompanySignal("overwatch");
  const patent = getCompanySignal("patent");
  const gaia = getCompanySignal("gaia");
  const athena = getCompanySignal("athena");

  const brief = {
    date: companyState.generatedAt,
    prometheusStatus: `${companyState.platformDefinition} ${routeIq?.detail || companyState.products.routeIq.detail}`,
    highestRoiTask: companyState.chiefOfStaff.highestRoiTask,
    biggestRisk: companyState.chiefOfStaff.biggestRisk,
    routeIqStatus: `${routeIq?.value || "Operational"}. ${routeIq?.detail || ""}`,
    patentStatus: `${patent?.value || "Patent Pending"}. ${patent?.detail || ""}`,
    productPortfolio: `Gaia: ${gaia?.value || "Paused"}. Athena: ${athena?.value || "Architecture Only"}.`,
    companyPhase: `${phase?.value || "Operational Scale-Up"}. ${phase?.detail || companyState.currentPhase.join(", ")}`,
    overwatchStatus: `${overwatch?.value || "Active Governance"}. ${overwatch?.detail || companyState.overwatch.detail}`,
    founderScorecard: founderScorecardText(),
    recommendedNextAction: companyState.chiefOfStaff.recommendedNextAction
  };

  if (voiceLength === "long") return brief;

  return {
    title: "Daily Founder Brief",
    body: [
      "Here is today's Founder brief.",
      "Route IQ is operational and Patent Pending.",
      "Gaia is paused. Athena is architecture only.",
      `Current phase: ${companyState.currentPhase.join(", ")}.`,
      `Highest ROI task: ${brief.highestRoiTask}`,
      `Biggest risk: ${brief.biggestRisk}`,
      `Recommended focus: ${brief.recommendedNextAction}`
    ].join(" ")
  };
}

export function createDailyBriefMarkdown() {
  const brief = createDailyBrief({ voiceLength: "long" });
  return `# Prometheus Daily Founder Brief - ${brief.date}

## Current Prometheus State
${brief.prometheusStatus}

## Route IQ
${brief.routeIqStatus}

## Patent Status
${brief.patentStatus}

## Product Portfolio
${brief.productPortfolio}

## Current Company Phase
${brief.companyPhase}

## Highest ROI Task
${brief.highestRoiTask}

## Biggest Company Risk
${brief.biggestRisk}

## Overwatch
${brief.overwatchStatus}

## Founder Scorecard
${brief.founderScorecard}

## Recommended Next Action
${brief.recommendedNextAction}
`;
}
