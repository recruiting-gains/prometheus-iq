# Release Notes And Version History Workflow

## Purpose

Keep beta-facing release history understandable without replacing the existing engineering release checklist.

## Inputs

Release records should reference:

- Product commit when known.
- Deployment ID or worker version when verified.
- App build marker when verified.
- Tester impact.
- Known beta risks.
- Required tester action.
- Rollback or pause condition.

## Procedure

1. Engineering completes subsystem work and verification.
2. Infrastructure deploys or verifies production when required.
3. Administration records the beta-facing release in `registers/release-history.json`.
4. Administration identifies testers affected by the release.
5. Administration updates onboarding or known-issue notes if required.
6. Founder decides whether testers continue, pause, or refresh their PWA/browser session.

## Release Note Standard

A release note must state:

- What changed in user-facing terms.
- Who is affected.
- What the tester must do.
- What was verified.
- What remains unknown.

Do not claim a release is live, deployed, or production-verified unless deployment and production checks are recorded.
