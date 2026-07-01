# Administration Operating Model

## Default Cadence

Daily during active beta:

- Confirm active testers can access the app.
- Review incoming bugs and feature requests.
- Review positive feedback, workflow observations, route quality observations, and performance observations.
- Confirm no critical issue blocks field use.
- Record any device or browser issues.
- Record release/version friction.
- Record session history for meaningful tester activity.

Weekly during active beta:

- Review tester statuses.
- Review NDA/agreement statuses.
- Review onboarding completion.
- Review open bugs by severity.
- Review feature requests by impact and frequency.
- Review route quality and performance observations by owner subsystem.
- Review regression verification and tester sign-off status for recently resolved issues.
- Decide whether beta scope should continue, pause, expand, or narrow.

Before adding any tester:

- Confirm candidate approval.
- Confirm legal agreement path.
- Confirm intended permission role.
- Confirm device readiness.
- Confirm release/version assignment.
- Confirm onboarding checklist owner.

## Status Vocabulary

Tester statuses:

- `candidate`: proposed but not approved.
- `approved_pending_nda`: approved subject to agreement completion.
- `approved_pending_access`: agreement path complete, waiting for Infrastructure access.
- `onboarding`: access exists, tester is being trained.
- `active`: tester is field-ready.
- `paused`: tester should not use the beta until cleared.
- `complete`: tester finished the beta.
- `removed`: tester is no longer approved.

Bug statuses:

- `new`
- `triaged`
- `blocked`
- `in_progress`
- `waiting_for_tester`
- `resolved`
- `deferred`
- `closed`

Stabilization issue statuses:

- `new`
- `classified`
- `routed`
- `subsystem_in_progress`
- `subsystem_handoff_received`
- `regression_pending`
- `tester_verification_pending`
- `closed`
- `deferred`

Tester sign-off statuses:

- `not_required`
- `pending`
- `passed`
- `failed`
- `blocked`

Feature request statuses:

- `captured`
- `needs_evidence`
- `accepted_for_later`
- `rejected`
- `duplicate`
- `converted_to_task`

## Change Control

During private beta, Administration should separate operational issues from engineering work:

- Critical bugs can become engineering tasks immediately.
- Major bugs can become engineering tasks after reproduction is clear.
- Minor bugs and feature requests should be batched for review.
- New product features should not be added during a live pilot unless the pilot cannot continue.

## Intake Categories

Every issue must be classified into one of the permanent subsystem categories:

- Dashboard
- Data
- Intelligence Engine
- Infrastructure
- CRM
- Companion
- Mobile
- Website
- Social Media
- Research
- Sales
- Administration

Every issue must use one of the permanent severities:

- Critical
- High
- Medium
- Low
- Feature Request

## Escalation

Escalate to Infrastructure when:

- A tester cannot access the protected beta URL.
- Cloudflare Access policy changes are required.
- Authenticated production verification is required.
- A deployment or service worker issue is suspected.

Escalate to Dashboard when:

- Rep mode, logging, routes, copy/export, or visible app behavior is broken.
- Owner/admin controls appear for a tester.
- A product release is required.

Escalate to Legal/Founder review when:

- NDA status is uncertain.
- A business wants to bind a company pilot.
- Tester data may involve employer-confidential information.

Escalate to CRM only after explicit approval for outbound communication workflows.

## Evidence Standard

Administration records must distinguish:

- Verified facts.
- Tester-reported facts.
- Founder assumptions.
- Unknowns.

Do not mark a tester, bug, release, pilot, or requirement complete unless the relevant verification is recorded.
