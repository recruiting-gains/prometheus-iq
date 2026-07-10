export function createCompanionReliabilityReport() {
  return {
    title: "Companion Reliability Monitor",
    body: [
      "Check order: local server, backend health, microphone permission, STT transcript capture, intent router match, response generation, TTS request, audio playback, and listening resume.",
      "If one step fails, fix that step directly before changing the rest of the system.",
      "Current rule: Prometheus must not overlap speech, must not listen while speaking, and must report the exact failed stage."
    ].join(" ")
  };
}

export function createEndOfDayDebrief() {
  return {
    title: "End-of-Day Debrief",
    body: [
      "What changed: Prometheus Companion synchronized its founder knowledge with the current Route IQ operating state, product portfolio, company phase, and Founder workflow.",
      "What was learned: the highest ROI is reliable customer operation of the primary product, not ungoverned expansion.",
      "Blocked: live voice behavior still needs Cruz's manual microphone and audio test in the Companion window.",
      "Safe-to-commit status depends on git review, secret scan, and explicit approval.",
      "Tomorrow's highest ROI task: close the highest-risk deployment or customer-onboarding gap."
    ].join(" ")
  };
}

export function createCommandInventory() {
  return {
    title: "Companion Command Inventory",
    body: [
      "Chief of Staff: daily brief, top 3 priorities, what should I do next, where are we at, give me the rundown, what matters right now.",
      "Operations: customer feedback, route quality issue, onboarding issue, deployment readiness.",
      "Products: Route IQ status, Gaia status, Athena status, patent status.",
      "Backup: prepare GitHub backup, commit message, backup checklist.",
      "Reliability: check companion health, voice health, TTS status.",
      "Debrief: end of day debrief, what changed today, progress log."
    ].join(" ")
  };
}

export function createCompanionIntelligenceRoadmap() {
  return {
    title: "Companion Intelligence Roadmap",
    body: [
      "Next 7 days: protect Companion reliability, close deployment-readiness gaps, and keep backups clean.",
      "Next 30 days: strengthen customer onboarding, CRM continuity, and Route IQ operational feedback.",
      "Next 90 days: continue enterprise hardening and compound improvements from real customer operations without changing product scope."
    ].join(" ")
  };
}
