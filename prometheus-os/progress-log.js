import { createDailyBriefMarkdown } from "./daily-brief.js";

export function createDailyProgressLogEntry() {
  return `# Daily Progress Log - 2026-06-24

## What Changed
- Prometheus Companion was shifted away from automatic login launch and toward manual Dock launch.
- The Companion greeting was updated to: "Hey Boss lets get to work im here for any update you need."
- Premium ElevenLabs voice support was configured locally for Mark's voice through the private backend path.
- Prometheus OS voice command handling was improved for company-signal nodes.
- Prometheus Companion was given the foundation for Daily Chief of Staff briefs, progress summaries, and GitHub backup preparation.

## Files Changed
- prometheus-os/daily-brief.js
- prometheus-os/founder-scorecard.js
- prometheus-os/github-backup-checklist.js
- prometheus-os/progress-log.js
- prometheus-os/agent-actions.js
- prometheus-os/ai-provider.js
- prometheus-os/demo-data.js
- prometheus-os/README.md
- mac-companion/PrometheusCompanion.swift
- mac-companion/README.md
- PROMETHEUS OPERATING SYSTEM/09 Founder Operating System/Daily Progress Log.md

## Product Progress
- No production Prometheus IQ behavior was intentionally changed by this Daily Chief of Staff work.

## Website Progress
- No public website deployment was performed by this Daily Chief of Staff work.

## Companion Progress
- Prometheus Companion is being upgraded from a visual assistant into a private Daily Chief of Staff that can brief Cruz, summarize progress, and prepare backup steps.

## Beta Progress
- Anthony beta remains protected and separate. The Daily Chief of Staff layer does not modify Anthony data or production beta behavior.

## Business Progress
- Prometheus now has a clearer operating rhythm: daily brief, highest ROI task, company risk, pilot readiness, leadership follow-up, social opportunity, founder scorecard, and backup discipline.

## Deployment Status
- No public deployment was performed.

## GitHub Commit Status
- Commit and push require explicit Cruz approval.

## Next Recommended Move
- Test the Daily Founder Brief voice command, review changed files, then decide whether to prepare a GitHub backup.
`;
}

export function createProgressLogSummary() {
  return {
    title: "Daily Progress Log",
    body: "Today’s progress log is ready. Prometheus Companion moved closer to a Daily Chief of Staff: brief, risk, scorecard, progress summary, and GitHub backup preparation. No deploy or push has been performed."
  };
}

export function createCompanionProgressSummary() {
  return {
    title: "Prometheus Companion Progress",
    body: "Prometheus Companion now opens manually from the Dock, uses the updated company logo, speaks with the configured premium voice when the backend is running, and is being upgraded into a Daily Chief of Staff for briefs, progress logs, GitHub backup preparation, and founder next actions."
  };
}

export function createDailyBriefAndLogBundle() {
  return `${createDailyBriefMarkdown()}

---

${createDailyProgressLogEntry()}`;
}
