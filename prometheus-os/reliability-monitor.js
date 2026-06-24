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
      "What changed: Prometheus Companion gained stronger Chief of Staff behavior, safer routing, better founder priorities, beta feedback handling, draft-only email support, and reliability monitoring.",
      "What was learned: the highest ROI remains validation, not feature expansion.",
      "Blocked: live voice behavior still needs Cruz's manual microphone and audio test in the Companion window.",
      "Safe-to-commit status depends on git review, secret scan, and explicit approval.",
      "Tomorrow's highest ROI task: collect and structure real beta feedback."
    ].join(" ")
  };
}

export function createCommandInventory() {
  return {
    title: "Companion Command Inventory",
    body: [
      "Chief of Staff: daily brief, top 3 priorities, what should I do next, where are we at, give me the rundown, what matters right now.",
      "Beta: Anthony feedback, beta feedback, route quality issue, training issue.",
      "Leadership: what should I tell Chris, Chris follow-up, executive note.",
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
      "Next 7 days: stabilize voice capture, test premium TTS, collect Anthony feedback, and keep backups clean.",
      "Next 30 days: connect feedback to pilot reporting, improve route-quality review, and turn leadership updates into repeatable templates.",
      "Next 90 days: add authenticated cloud-safe founder access, real integrations only after security review, and company-wide operating memory."
    ].join(" ")
  };
}
