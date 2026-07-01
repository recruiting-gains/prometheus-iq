# Bug Intake Workflow

## Purpose

Capture beta problems consistently and decide whether they require immediate engineering.

## Intake Fields

Use `templates/bug-report.md` and record the issue in `registers/stabilization-issues.json`. `registers/bug-intake.json` remains as the legacy bug-only register and should not become a duplicate system.

Required fields:

- Issue ID.
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
- Regression verified.
- Resolved version.
- Tester verification.

## Severity

- `Critical`: app cannot open, data loss, security issue, owner/rep separation failure, export unavailable during required handoff, or route quality issue that could send a tester to an unsafe or non-business destination.
- `High`: core route, logging, beta access, performance, or mobile workflow materially affected.
- `Medium`: tester can continue, but friction is meaningful or evidence is incomplete.
- `Low`: annoying, cosmetic, wording, or operational cleanup.
- `Feature Request`: requested capability that is not a confirmed defect.

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
