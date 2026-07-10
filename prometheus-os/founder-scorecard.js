import { companyState } from "./demo-data.js";

export function getFounderScorecard() {
  return [
    {
      label: "Product Discipline",
      score: "9/10",
      detail: "Route IQ is operational, Patent Pending, and the primary product. Gaia is paused and Athena is architecture only."
    },
    {
      label: "Deployment Readiness",
      score: "8/10",
      detail: "The platform is in deployment readiness. Authenticated verification and remaining account-owner controls must stay tied to current Overwatch evidence."
    },
    {
      label: "Founder Execution",
      score: "8/10",
      detail: "The current Founder workflow connects workspace selection, Today's Mission, Research, prospect calls, CRM stage updates, evidence-based handoff, and follow-up."
    },
    {
      label: "Business Risk Control",
      score: "7/10",
      detail: "Workspace isolation, subsystem ownership, source control, patent documentation, and Overwatch governance are explicit operating controls."
    },
    {
      label: "Customer Onboarding",
      score: "7/10",
      detail: "Customer onboarding is a current company phase. Every call, stage, readiness signal, follow-up, and JR handoff should remain in the governed record."
    },
    {
      label: "Founder Focus",
      score: "7/10",
      detail: "The next unlock is disciplined execution: complete today's customer mission, close verified readiness work, and avoid ungoverned product expansion."
    }
  ];
}

export function founderScorecardText() {
  return getFounderScorecard()
    .map((item) => `${item.label}: ${item.score}. ${item.detail}`)
    .join(" ");
}

export function getCompanySignal(key) {
  return companyState.statusCards.find((card) => card.key === key);
}
