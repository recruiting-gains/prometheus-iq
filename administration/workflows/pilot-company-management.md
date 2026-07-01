# Pilot Company Management Workflow

## Purpose

Track pilot companies separately from individual beta testers.

## Intake

Record pilot companies in `registers/pilot-companies.json`.

Required fields:

- Company ID.
- Company name.
- Status.
- Pilot type.
- Approved users count.
- Manager/reviewer role.
- Agreement path.
- Start and end dates.
- Success metrics.
- Data restrictions.
- Operational owner.

## Statuses

- `prospect`
- `discussion`
- `approved_pending_agreement`
- `approved_pending_setup`
- `active`
- `paused`
- `complete`
- `declined`

## Operating Rules

- Do not treat an individual tester NDA as business authorization.
- Do not enter employer-confidential or customer personal data without written permission.
- Keep approved users explicit.
- Keep manager expectations documented.
- Keep pilot success criteria defined before field use starts.
- Keep final report preparation active throughout the pilot.
