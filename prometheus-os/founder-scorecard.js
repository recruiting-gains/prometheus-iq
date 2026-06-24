import { companyState } from "./demo-data.js";

export function getFounderScorecard() {
  return [
    {
      label: "Product Discipline",
      score: "8/10",
      detail: "Route Intelligence, GPS verification, rep mode, owner mode, and Anthony's beta path are in place. The key is avoiding unnecessary feature work until beta feedback is real."
    },
    {
      label: "Pilot Readiness",
      score: "8/10",
      detail: "Executive materials, pilot package, success metrics, and risk controls are prepared. The missing proof is external pilot usage data."
    },
    {
      label: "Founder Execution",
      score: "8/10",
      detail: "Website, GitHub, Cloudflare, companion, and operating documents are moving together. Keep sessions focused and end with a backup decision."
    },
    {
      label: "Business Risk Control",
      score: "7/10",
      detail: "The company has stronger safeguards and documents than before. The main risk is still validating adoption before selling too broadly."
    },
    {
      label: "Market Proof",
      score: "6/10",
      detail: "Internal progress is strong, but Prometheus needs clean beta data, rep feedback, and leadership response before the story becomes enterprise-grade proof."
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
