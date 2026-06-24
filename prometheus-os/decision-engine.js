const weights = {
  revenueImpact: 0.18,
  pilotImpact: 0.24,
  founderLeverage: 0.18,
  validationValue: 0.22,
  riskReduction: 0.12,
  strategicImportance: 0.06
};

export const decisionTasks = [
  {
    id: "anthony-beta-feedback",
    title: "Capture Anthony beta feedback",
    description: "Collect real usage feedback, route quality notes, visit logs, GPS verification behavior, and friction points.",
    revenueImpact: 8,
    pilotImpact: 10,
    founderLeverage: 8,
    validationValue: 10,
    riskReduction: 8,
    strategicImportance: 9,
    reason: "External beta evidence is the strongest path from internal build progress to pilot credibility."
  },
  {
    id: "leadership-follow-up",
    title: "Prepare Chris / Dallas follow-up",
    description: "Keep the leadership ask simple: controlled 14-day pilot, three approved users, risk controls, weekly review, final report.",
    revenueImpact: 9,
    pilotImpact: 9,
    founderLeverage: 8,
    validationValue: 8,
    riskReduction: 7,
    strategicImportance: 9,
    reason: "Leadership clarity can convert product readiness into an approved test."
  },
  {
    id: "companion-memory-update",
    title: "Keep Prometheus memory current",
    description: "Update the daily progress log and memory timeline after major work so Prometheus does not lose company context.",
    revenueImpact: 5,
    pilotImpact: 7,
    founderLeverage: 10,
    validationValue: 6,
    riskReduction: 8,
    strategicImportance: 8,
    reason: "Founder leverage increases when decisions and company history stop living only in Cruz's head."
  },
  {
    id: "github-backup-review",
    title: "Prepare clean GitHub backup",
    description: "Review changed files, exclude secrets/build artifacts/screenshots, then commit and push only after explicit approval.",
    revenueImpact: 5,
    pilotImpact: 6,
    founderLeverage: 8,
    validationValue: 5,
    riskReduction: 10,
    strategicImportance: 7,
    reason: "A clean repository protects source code, preserves progress, and reduces recovery risk."
  },
  {
    id: "public-social-proof",
    title: "Post one build-in-public update",
    description: "Share progress around field-sales intelligence and private pilot preparation without revealing proprietary logic.",
    revenueImpact: 6,
    pilotImpact: 5,
    founderLeverage: 6,
    validationValue: 5,
    riskReduction: 3,
    strategicImportance: 6,
    reason: "Social proof helps market learning, but it should not outrank beta validation."
  },
  {
    id: "new-feature-build",
    title: "Avoid building a new feature tonight",
    description: "Defer shiny new features unless they directly reduce beta risk or increase pilot approval odds.",
    revenueImpact: 3,
    pilotImpact: 4,
    founderLeverage: 4,
    validationValue: 3,
    riskReduction: 4,
    strategicImportance: 4,
    reason: "Feature expansion without usage data can dilute focus."
  }
];

export function scoreDecisionTask(task) {
  return Object.entries(weights).reduce((total, [key, weight]) => {
    return total + ((task[key] || 0) * weight);
  }, 0);
}

export function rankDecisionTasks(tasks = decisionTasks) {
  return tasks
    .map((task) => ({ ...task, score: Number(scoreDecisionTask(task).toFixed(2)) }))
    .sort((a, b) => b.score - a.score);
}

export function createDecisionEngineSummary() {
  const ranked = rankDecisionTasks();
  const top = ranked.slice(0, 3);
  return {
    title: "Prometheus Decision Engine",
    body: [
      "I scored founder tasks by revenue impact, pilot impact, founder leverage, validation value, risk reduction, and strategic importance.",
      `Top 3: ${top.map((task, index) => `${index + 1}. ${task.title} (${task.score}/10)`).join(" ")}`,
      `Highest ROI: ${top[0].title}. ${top[0].reason}`
    ].join(" ")
  };
}

export function createTopFounderPrioritiesV2() {
  const top = rankDecisionTasks().slice(0, 3);
  return {
    title: "Top 3 founder priorities",
    body: top.map((task, index) => {
      return `${index + 1}. ${task.title}: ${task.description} Reason: ${task.reason}`;
    }).join(" ")
  };
}

export function createRoadmapGenerator() {
  return {
    title: "Prometheus Roadmap Generator",
    body: [
      "Next 7 days: collect Anthony beta feedback, update the memory log daily, keep GitHub clean, and prepare leadership follow-up material only after real feedback arrives.",
      "Next 30 days: convert beta feedback into pilot results, tighten Route Intelligence quality, finalize LLC and banking basics, and secure at least one external pilot path.",
      "Next 90 days: turn pilot outcomes into repeatable onboarding, reporting, pricing, customer success, and route-data refresh systems.",
      "Ranking logic: validation and pilot approval outrank new features until real external evidence is strong."
    ].join(" ")
  };
}

export function createMorningCooBriefV2() {
  const ranked = rankDecisionTasks();
  const top = ranked[0];
  return {
    title: "Morning COO Brief v2",
    body: [
      "What changed: Prometheus now has a stronger Companion, premium voice path, daily Chief of Staff modules, and a local memory system.",
      "What matters: prove the product with beta usage before expanding features.",
      "Biggest blocker: no fresh external pilot data has been collected inside the system yet.",
      "Biggest opportunity: Anthony beta can turn the app from a founder-built tool into evidence a leadership team can evaluate.",
      `Highest ROI action: ${top.title}.`,
      "Founder warning: do not confuse a better operating system with market validation.",
      "Pilot status: readiness is high, but approval and usage proof are still the next gates."
    ].join(" ")
  };
}
