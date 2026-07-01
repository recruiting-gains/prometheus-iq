# Bug Intake Workflow

## Purpose

Capture beta problems consistently and decide whether they require immediate engineering.

## Intake Fields

Use `templates/bug-report.md` and record the issue in `registers/bug-intake.json`.

Required fields:

- Bug ID.
- Reporter/tester ID.
- Date reported.
- Device ID when known.
- App version or release ID when known.
- Severity.
- Category.
- Reproduction steps.
- Expected behavior.
- Actual behavior.
- Data/security risk.
- Pilot blocker flag.
- Owner.
- Status.

## Severity

- `critical`: app cannot open, data loss, security issue, owner/rep separation failure, export unavailable during required handoff.
- `major`: core route, logging, or beta access workflow materially broken.
- `minor`: tester can continue but meaningful friction exists.
- `trivial`: cosmetic, copy, or polish.

## Triage Decision

Same-day engineering is justified only when:

- The beta cannot continue.
- Tester privacy or owner/rep separation is at risk.
- Required beta data cannot be exported or preserved.
- Access is broken for an approved active tester.

Otherwise, keep the bug documented and batch it for post-beta planning.

## Engineering Handoff

When a bug becomes an engineering task, include:

- Bug ID.
- Owning subsystem.
- Reproduction steps.
- Verified device/browser context.
- Expected result.
- Actual result.
- Screenshots/logs location if available.
- Severity justification.
- Required checks.

Do not attach secrets, Cloudflare cookies, one-time PINs, API keys, or private customer data.
