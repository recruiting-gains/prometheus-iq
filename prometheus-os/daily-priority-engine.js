const weights = {
  businessImpact: 0.25,
  customerOnboarding: 0.25,
  operationalLeverage: 0.15,
  riskReduction: 0.15,
  founderEnergyFit: 0.1,
  urgency: 0.1
};

const founderTasks = [
  {
    id: "execute-founder-mission",
    label: "Execute today's Founder mission",
    businessImpact: 10,
    customerOnboarding: 10,
    operationalLeverage: 9,
    riskReduction: 8,
    founderEnergyFit: 9,
    urgency: 10,
    reason: "The current company phase creates value through disciplined customer execution, not another disconnected build thread.",
    nextStep: "Select the active workspace, set Today's Mission, review the Research dossier, and call the highest-value prospects first."
  },
  {
    id: "deployment-readiness-evidence",
    label: "Close the next deployment-readiness item",
    businessImpact: 9,
    customerOnboarding: 8,
    operationalLeverage: 9,
    riskReduction: 10,
    founderEnergyFit: 7,
    urgency: 9,
    reason: "Verified readiness evidence protects an operational Route IQ while customers are being onboarded.",
    nextStep: "Finish the next authenticated verification or account-owner control already recorded by Overwatch."
  },
  {
    id: "crm-operating-discipline",
    label: "Preserve customer evidence in CRM",
    businessImpact: 9,
    customerOnboarding: 10,
    operationalLeverage: 8,
    riskReduction: 8,
    founderEnergyFit: 8,
    urgency: 9,
    reason: "Customer onboarding compounds only when each call, candidate stage, readiness signal, and follow-up survives the session.",
    nextStep: "Update the candidate stage after every call and hand off to JR only when the evidence supports it."
  },
  {
    id: "enterprise-hardening",
    label: "Complete the next enterprise-hardening control",
    businessImpact: 8,
    customerOnboarding: 7,
    operationalLeverage: 8,
    riskReduction: 10,
    founderEnergyFit: 6,
    urgency: 8,
    reason: "Account-owner security and workspace isolation are part of current operating readiness.",
    nextStep: "Use the current Overwatch checkpoint and close one verified owner action without changing subsystem ownership."
  },
  {
    id: "route-iq-improvement",
    label: "Improve one verified Route IQ workflow",
    businessImpact: 8,
    customerOnboarding: 8,
    operationalLeverage: 9,
    riskReduction: 7,
    founderEnergyFit: 8,
    urgency: 7,
    reason: "Route IQ is operational and should improve through observed operating evidence.",
    nextStep: "Choose one verified workflow issue, preserve current behavior, and document any material invention change in the patent workspace."
  },
  {
    id: "unscoped-expansion",
    label: "Open an unscoped product expansion",
    businessImpact: 4,
    customerOnboarding: 2,
    operationalLeverage: 3,
    riskReduction: 2,
    founderEnergyFit: 4,
    urgency: 1,
    reason: "Gaia is paused and Athena is architecture only; ungoverned expansion would pull attention away from the current phase.",
    nextStep: "Do not expand the product set unless current governed evidence changes the company priority."
  }
];

function weightedScore(task) {
  return Object.entries(weights).reduce((total, [key, weight]) => {
    return total + (Number(task[key]) || 0) * weight;
  }, 0);
}

export function rankFounderTasks(tasks = founderTasks) {
  return tasks
    .map((task) => ({
      ...task,
      score: Number(weightedScore(task).toFixed(2))
    }))
    .sort((a, b) => b.score - a.score);
}

export function createTopThreePriorities() {
  const ranked = rankFounderTasks();
  const topThree = ranked.slice(0, 3);
  return {
    title: "Top 3 Prometheus Priorities",
    body: topThree
      .map((task, index) => {
        const lead = index === 0 ? "Top priority" : index === 1 ? "Second" : "Third";
        return `${lead}: ${task.label}. ${task.reason} Next move: ${task.nextStep}`;
      })
      .join(" ")
  };
}

export function createNextActionBrief() {
  const [task] = rankFounderTasks();
  return {
    title: "Highest ROI Task",
    body: `${task.label}. ${task.reason} Next move: ${task.nextStep}`
  };
}

export function createDailyPriorityEngineSummary() {
  return {
    title: "Daily Priority Engine",
    body: "Prometheus ranks Founder work by business impact, customer onboarding, operational leverage, risk reduction, Founder energy, and urgency. Current mission execution and verified readiness outrank unscoped expansion."
  };
}
