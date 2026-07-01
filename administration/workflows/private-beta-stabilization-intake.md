# Private Beta Stabilization Intake Workflow

## Purpose

Create one permanent Administration-owned intake path for current and future private beta findings.

Administration owns intake, classification, records, routing, release verification tracking, regression verification tracking, and tester sign-off. Engineering owns the fixes after an issue is routed.

## Intake Order

1. Confirm tester profile in `registers/beta-testers.json`.
2. Confirm company profile in `registers/pilot-companies.json` when the tester belongs to a pilot company.
3. Confirm device profile in `registers/device-inventory.json`.
4. Create or update a test session in `registers/test-session-history.json`.
5. Record the finding in `registers/stabilization-issues.json` or `registers/beta-observations.json`.
6. Classify category and severity using `registers/intake-classification.json`.
7. Route confirmed engineering work to the owning subsystem.
8. Record subsystem handoff status.
9. Record release verification after the fix is released or confirmed not deployment-bound.
10. Record regression verification.
11. Capture tester sign-off before closing beta-impacting issues.

## Intake Types

Use unified issues for:

- Bugs.
- Feature requests that need engineering review.
- Route quality failures.
- Performance failures.
- Release verification blockers.
- Regression failures.

Use observations for:

- Positive feedback.
- Workflow observations.
- Route quality notes that are not confirmed defects yet.
- Performance notes that require more evidence.

## Closure Rule

An issue may close only when:

- The subsystem owner has returned a handoff or Administration has explicitly deferred the issue.
- Regression verification is complete or marked not required with a reason.
- Tester verification is complete or marked not required with a reason.
- The resolved version is recorded if a release changed tester-visible behavior.

## Scaling Rule

At 1 tester, records may be updated manually.

At 10 testers, every issue must cite tester, device, version, session, and subsystem owner before routing.

At 100 testers, every release must have affected-testers tracking and regression sampling before tester sign-off.

For enterprise pilots, every issue must also cite company profile, manager/reviewer context, legal/agreement state, data restrictions, and pilot success metric impact.
