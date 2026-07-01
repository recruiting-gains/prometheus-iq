# Release, Regression, And Tester Sign-Off Workflow

## Purpose

Ensure beta-impacting fixes do not close until Administration records release verification, regression verification, and tester sign-off.

## Release Verification

Record release verification in `registers/release-history.json` or in the linked issue record.

Required release facts:

- Release ID or version.
- Engineering commit when known.
- Deployment status when relevant.
- Affected testers.
- Required tester action.
- Known issues.
- Unknowns.

Do not claim production deployment when Infrastructure has not verified production.

## Regression Verification

Regression verification must answer:

- Did the original issue stop reproducing?
- Did the critical adjacent workflow still pass?
- Was the same tester role tested?
- Was the same device class tested or explicitly deferred?
- Which command, manual check, or handoff proves it?

## Tester Sign-Off

Tester sign-off must record:

- Tester ID.
- Device ID.
- Version.
- Result.
- Date.
- Any remaining friction.

Tester sign-off is required for Critical and High beta-impacting issues unless the founder explicitly marks tester sign-off not required with a reason.

## Closeout

Close an issue only after:

- Regression status is `passed` or `not_required`.
- Tester verification status is `passed` or `not_required`.
- Resolved version is recorded for tester-visible fixes.
- Future subsystem handoffs are recorded if additional engineering remains.
