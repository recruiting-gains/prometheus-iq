import { createDailyBriefMarkdown } from "./daily-brief.js";

export function createDailyProgressLogEntry() {
  return `# Daily Progress Log - 2026-07-10

## What Changed
- Prometheus Companion knowledge was synchronized to the current platform state.
- Route IQ is represented as operational, Patent Pending, and the primary product.
- Gaia is represented as paused and Athena as architecture only.
- The current company phase and exact Founder workflow now drive Companion guidance.

## Files Changed
- prometheus-os/daily-brief.js
- prometheus-os/founder-scorecard.js
- prometheus-os/github-backup-checklist.js
- prometheus-os/progress-log.js
- prometheus-os/agent-actions.js
- prometheus-os/ai-provider.js
- prometheus-os/demo-data.js
- Companion knowledge and verification modules only.

## Product Progress
- No Route IQ product behavior was changed.

## Website Progress
- No public website deployment was performed by this Daily Chief of Staff work.

## Companion Progress
- Prometheus Companion now reasons from current company, product, operational, patent, and Founder-workflow state.

## Business Progress
- Prometheus is focused on deployment readiness, customer onboarding, enterprise hardening, and continuous operational improvement.

## Deployment Status
- No public deployment was performed.

## GitHub Commit Status
- Commit and push require explicit Cruz approval.

## Next Recommended Move
- Run Companion verification, review the synchronization report, and keep execution centered on Route IQ customer operations.
`;
}

export function createProgressLogSummary() {
  return {
    title: "Daily Progress Log",
    body: "Today's progress log reflects the current platform state: Route IQ operational and Patent Pending, Gaia paused, Athena architecture only, and the company focused on readiness, onboarding, hardening, and continuous improvement."
  };
}

export function createCompanionProgressSummary() {
  return {
    title: "Prometheus Companion Progress",
    body: "Prometheus Companion is the Founder operating layer. Its company knowledge, product status, Overwatch state, patent status, current phase, and Founder workflow are synchronized with the repository source of truth."
  };
}

export function createDailyBriefAndLogBundle() {
  return `${createDailyBriefMarkdown()}

---

${createDailyProgressLogEntry()}`;
}
