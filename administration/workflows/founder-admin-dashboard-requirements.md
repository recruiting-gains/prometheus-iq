# Founder Administrative Dashboard Requirements

## Purpose

Define what a future Administration dashboard must show when Prometheus is ready for a productized admin surface.

This is a requirements document only. It does not implement Dashboard changes.

## Required Views

Tester operations:

- Total testers by status.
- Active testers.
- Paused testers.
- Pending NDA/agreement.
- Pending access.
- Onboarding incomplete.

Device operations:

- Active devices by tester.
- Unverified devices.
- Device/browser issue history.
- Lost or retired devices.

Release operations:

- Current beta release.
- Testers assigned to each release.
- Known issues by release.
- Required tester refresh or reinstall notes.

Bug operations:

- Open critical and major bugs.
- Bugs by tester.
- Bugs by release.
- Bugs waiting for tester response.

Request operations:

- Top repeated feature requests.
- Requests needing evidence.
- Requests accepted for later.

Pilot company operations:

- Companies by pilot status.
- Approved user count.
- Agreement status.
- Pilot start/end dates.
- Success metrics.

## Non-Goals

- Do not expose Cloudflare secrets or access tokens.
- Do not replace Infrastructure deployment controls.
- Do not expose Companion data.
- Do not implement CRM messaging.
- Do not centralize field result data until a backend sync project is explicitly approved.
