const weights = {
  customerImpact: 0.24,
  operationalImpact: 0.22,
  founderLeverage: 0.18,
  readinessValue: 0.18,
  riskReduction: 0.12,
  strategicImportance: 0.06
};

export const decisionTasks = [
  {
    id: "founder-mission-execution",
    title: "Execute today's Founder mission",
    description: "Select the active workspace, set Today's Mission, review the Research dossier, and call the highest-value prospects first.",
    customerImpact: 10,
    operationalImpact: 10,
    founderLeverage: 9,
    readinessValue: 8,
    riskReduction: 7,
    strategicImportance: 10,
    reason: "Customer movement is the highest-value use of an operational Route IQ."
  },
  {
    id: "deployment-readiness",
    title: "Close the next verified readiness item",
    description: "Use the current Overwatch checkpoint to complete authenticated verification or an outstanding account-owner control.",
    customerImpact: 8,
    operationalImpact: 9,
    founderLeverage: 8,
    readinessValue: 10,
    riskReduction: 10,
    strategicImportance: 9,
    reason: "Verified readiness protects customer onboarding and enterprise confidence."
  },
  {
    id: "crm-customer-continuity",
    title: "Preserve customer movement in CRM",
    description: "Update the candidate stage after every call, record the next step, and hand off to JR only when evidence supports it.",
    customerImpact: 10,
    operationalImpact: 9,
    founderLeverage: 8,
    readinessValue: 8,
    riskReduction: 8,
    strategicImportance: 8,
    reason: "Customer onboarding compounds only when the operating record survives each conversation."
  },
  {
    id: "companion-memory-current",
    title: "Keep governed platform memory current",
    description: "Record verified changes so Companion and Overwatch do not operate from historical assumptions.",
    customerImpact: 6,
    operationalImpact: 9,
    founderLeverage: 10,
    readinessValue: 8,
    riskReduction: 9,
    strategicImportance: 8,
    reason: "Current state is an operating dependency for Founder decisions."
  },
  {
    id: "route-iq-improvement",
    title: "Improve one verified Route IQ workflow",
    description: "Use observed operational evidence, preserve current behavior, and document material invention changes.",
    customerImpact: 9,
    operationalImpact: 9,
    founderLeverage: 7,
    readinessValue: 8,
    riskReduction: 7,
    strategicImportance: 9,
    reason: "Continuous improvement should follow real operating evidence."
  },
  {
    id: "ungoverned-expansion",
    title: "Avoid ungoverned product expansion",
    description: "Keep Gaia paused and Athena architecture only until the governed company phase changes.",
    customerImpact: 3,
    operationalImpact: 3,
    founderLeverage: 4,
    readinessValue: 2,
    riskReduction: 4,
    strategicImportance: 4,
    reason: "Expansion now would dilute Route IQ operations and customer onboarding."
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
      "I scored Founder work by customer impact, operational impact, Founder leverage, readiness value, risk reduction, and strategic importance.",
      `Top 3: ${top.map((task, index) => `${index + 1}. ${task.title} (${task.score}/10)`).join(" ")}`,
      `Highest ROI: ${top[0].title}. ${top[0].reason}`
    ].join(" ")
  };
}

export function createTopFounderPrioritiesV2() {
  const top = rankDecisionTasks().slice(0, 3);
  return {
    title: "Top 3 Founder Priorities",
    body: top.map((task, index) => `${index + 1}. ${task.title}: ${task.description} Reason: ${task.reason}`).join(" ")
  };
}

export function createRoadmapGenerator() {
  return {
    title: "Prometheus Roadmap Generator",
    body: [
      "Immediate: execute the active customer mission and close the next verified readiness item.",
      "Near term: make customer onboarding repeatable, complete enterprise hardening, and preserve workspace-specific CRM evidence.",
      "Ongoing: improve Route IQ from observed operations and document material invention changes.",
      "Product boundary: Gaia remains paused and Athena remains architecture only until Overwatch records a governed phase change."
    ].join(" ")
  };
}

export function createMorningCooBriefV2() {
  const top = rankDecisionTasks()[0];
  return {
    title: "Morning COO Brief v2",
    body: [
      "Route IQ is operational, Patent Pending, and the primary product.",
      "Gaia is paused. Athena is architecture only.",
      "The company is in deployment readiness, customer onboarding, enterprise hardening, and continuous operational improvement.",
      `Highest ROI action: ${top.title}.`,
      "Founder warning: do not let stale state or ungoverned expansion displace today's operating mission."
    ].join(" ")
  };
}
