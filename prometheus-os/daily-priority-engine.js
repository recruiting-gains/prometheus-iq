const weights = {
  businessImpact: 0.25,
  pilotValue: 0.25,
  revenuePotential: 0.15,
  riskReduction: 0.15,
  founderEnergyFit: 0.1,
  urgency: 0.1
};

const founderTasks = [
  {
    id: "anthony-beta-feedback",
    label: "Review Anthony beta feedback",
    businessImpact: 9,
    pilotValue: 10,
    revenuePotential: 8,
    riskReduction: 9,
    founderEnergyFit: 8,
    urgency: 10,
    reason: "Real beta feedback is the shortest path from internal progress to proof a buyer can trust.",
    nextStep: "Capture route clarity, GPS verification, logging friction, confusing moments, and whether the route felt useful."
  },
  {
    id: "leadership-follow-up",
    label: "Prepare the Chris leadership follow-up",
    businessImpact: 9,
    pilotValue: 8,
    revenuePotential: 9,
    riskReduction: 8,
    founderEnergyFit: 7,
    urgency: 9,
    reason: "A clean leadership follow-up can move Prometheus from interest to a controlled pilot conversation.",
    nextStep: "Keep the ask simple: three approved users, 14 days, weekly review, final report, and no proprietary disclosure."
  },
  {
    id: "github-backup-review",
    label: "Prepare a safe GitHub backup review",
    businessImpact: 7,
    pilotValue: 6,
    revenuePotential: 5,
    riskReduction: 10,
    founderEnergyFit: 8,
    urgency: 8,
    reason: "Clean backups protect source code, operating documents, and founder progress without risking secrets.",
    nextStep: "Run status, review changed files, confirm no .env or keys are staged, then ask before commit or push."
  },
  {
    id: "companion-reliability-test",
    label: "Test Prometheus Companion voice reliability",
    businessImpact: 7,
    pilotValue: 5,
    revenuePotential: 5,
    riskReduction: 8,
    founderEnergyFit: 7,
    urgency: 7,
    reason: "Companion is founder leverage, but unreliable voice can distract from pilot execution.",
    nextStep: "Test today's brief, what changed today, GitHub backup, Anthony status, and one follow-up question."
  },
  {
    id: "social-proof-post",
    label: "Create one safe social post",
    businessImpact: 6,
    pilotValue: 4,
    revenuePotential: 7,
    riskReduction: 4,
    founderEnergyFit: 8,
    urgency: 5,
    reason: "Public momentum helps the brand, but it should not outrank beta proof or leadership follow-up.",
    nextStep: "Post founder progress without showing internal routes, scoring, private customer data, or proprietary logic."
  },
  {
    id: "new-feature-build",
    label: "Build new product features",
    businessImpact: 5,
    pilotValue: 3,
    revenuePotential: 5,
    riskReduction: 3,
    founderEnergyFit: 4,
    urgency: 2,
    reason: "New features are lower ROI until Anthony's real beta feedback proves what needs to change.",
    nextStep: "Do not build unless beta evidence shows a blocker."
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
        return `${index + 1}. ${task.label}. Score ${task.score}/10. ${task.reason} Next: ${task.nextStep}`;
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
    body: "Prometheus ranks founder work by business impact, pilot value, revenue potential, risk reduction, founder energy, and urgency. Today, validation and leadership readiness beat new features."
  };
}
