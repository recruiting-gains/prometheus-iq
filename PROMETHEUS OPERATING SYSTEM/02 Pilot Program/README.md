# 02 Pilot Program

## Purpose

This folder is the operating center for pilots. It explains how a pilot is approved, launched, measured, managed, and closed.

## Included Documents

- `docs/prometheus-pilot-approval-package.md`
- `docs/prometheus-pilot-execution-playbook.md`
- `docs/prometheus-iq-pilot-success-metrics-framework.md`
- `docs/pilot-support-system.md`
- `docs/business-pilot-discovery-and-demo-dashboard-process.md`
- `docs/beta-sharing-plan.md`
- `legal/Prometheus_IQ_Pilot_Confidentiality_Agreement_DRAFT.docx`
- `legal/Prometheus_IQ_Authorized_User_NDA_DRAFT.docx`
- `legal/README.md`

## When To Use Each Document

- Pilot Approval Package: Use when management, HR, legal, or operations needs to understand pilot structure and controls.
- Pilot Execution Playbook: Use after approval, before Day 0 setup, and throughout the 14-day pilot.
- Pilot Success Metrics Framework: Use to measure whether Prometheus IQ improved field-sales execution.
- Pilot Support System: Use during Anthony's beta to classify bugs, collect feedback, and avoid unnecessary feature changes.
- Business Pilot Discovery And Demo Dashboard Process: Use before creating a separate demo dashboard or pilot setup for a new business.
- Beta Sharing Plan: Use when deciding how to let another person test the product safely.
- Pilot Confidentiality Agreement Draft: Use as a legal starting point before sharing deeper product access.
- Authorized User NDA Draft: Use for individual users who may access the app or pilot materials.
- Legal README: Use to understand the current legal-document drafts and limitations.

## Who Should Use This Folder

- Founder
- Pilot manager
- Customer success lead
- Operations lead
- Legal reviewer
- HR reviewer
- Future approved pilot users

## Future Documents That Belong Here

- Pilot onboarding checklist.
- Day 0 setup checklist.
- User training guide.
- Manager training guide.
- Pilot support tracker.
- Final pilot report template.
- Pilot debrief template.
- Pilot issue log.

## Guardrail

Pilot documents should explain what is being tested, what data is collected, and how risk is controlled. They should not explain proprietary recommendation logic.

## Beta Onboarding And Access Notes

Use this section before sending a protected beta link to any approved tester.

- Confirm the live URL opens the intended current dashboard, not an old local preview or stale deployment.
- Confirm Cloudflare Access protects the beta URL.
- Confirm the tester's exact email address is included in the existing Cloudflare Access policy.
- If Email One-Time PIN is enabled, tell the tester to request a fresh code from the same browser session where they will open Prometheus IQ. One-Time PIN codes are single-use and can fail if an older challenge/session is reused.
- If a code says it was already used, the tester should close the old login tab, open the beta URL again, request a fresh code, and enter only the newest code.
- Confirm Rep mode is loaded for the tester and that owner/admin controls are not visible.
- Confirm Google-qualified Route Intelligence is visible on the exact live beta URL when Google discovery is part of the pilot.
- Confirm directions links work before the tester leaves for the field.
- Keep a written record of visit count, conversations, leads, follow-ups, route quality feedback, login issues, and route-confidence concerns.

## Multi-Location And Manager Planning

For future pilots beyond one beta tester:

- Map each location to a territory, ZIP code cluster, manager, and approved user list.
- Define whether the pilot is single-location, district-level, or multi-market before sharing access.
- Assign each rep a separate profile so route history, recommendation history, and outcomes do not merge across users.
- Give managers reporting visibility without rep impersonation unless explicitly approved.
- Verify Cloudflare Access groups and policies before inviting users.
- Run a release verification on the exact live URL for each role: rep, owner/manager, and founder/admin.
