# Beta Tester Lifecycle Workflow

## Purpose

Move a beta tester from candidate to active field tester without changing product code or creating duplicate access systems.

## Intake

Record the candidate in `registers/beta-testers.json` with:

- Stable tester ID.
- Display name.
- Pilot company or independent tester context.
- Intended role.
- NDA/agreement path.
- Onboarding status.
- Device inventory link.
- Permission role.
- Current lifecycle status.

## Approval

Approval requires:

- Founder approval.
- Correct legal/agreement path selected.
- Permission role selected.
- Device readiness path selected.
- Release/version assignment selected.

## Access Request

Administration does not change Cloudflare Access.

When a tester is approved, Administration prepares an Infrastructure handoff containing:

- Tester ID.
- Approved access email, provided outside public repo files if sensitive.
- Intended beta URL.
- Permission role.
- Required verification checklist.

Infrastructure confirms access has been granted and verified.

## Onboarding

Use `templates/beta-tester-onboarding-checklist.md`.

Required onboarding topics:

- App purpose.
- Rep mode expectations.
- Field logging workflow.
- GPS verification boundaries.
- Copy/export data handoff.
- Bug reporting path.
- Feature request path.
- Data rules and prohibited data.
- Device/browser expectations.

## Activation

A tester can become `active` only after:

- Agreement status is acceptable for the beta context.
- Infrastructure access has been verified.
- Onboarding is complete.
- Device inventory has at least one active device record.
- Rep-mode access has been verified on the intended URL.
- Copy/export workflow has been explained.

## Pause Or Removal

Pause a tester when:

- Legal status becomes unclear.
- Access is compromised or misconfigured.
- The tester reports data exposure.
- Device is lost or no longer trusted.
- The beta scope changes.

Remove a tester when:

- Beta participation ends.
- Founder approval is withdrawn.
- Agreement requirements are not met.
- Security or confidentiality rules are violated.
