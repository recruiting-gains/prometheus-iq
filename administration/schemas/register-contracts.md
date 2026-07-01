# Administration Register Contracts

This folder documents the v1 register contracts. The validation gate checks required files and core structural expectations, but these contracts remain intentionally lightweight until Administration moves to a database-backed tool.

## Required Register Rules

All registers must:

- Use valid JSON.
- Include `schemaVersion`.
- Include `description`.
- Avoid secrets, one-time PINs, access cookies, passwords, API keys, and customer personal data.
- Use stable IDs for cross-reference.

## Stable ID Prefixes

- Tester: `tester-`
- Device: `device-`
- Company: `company-`
- Release: `release-`
- Bug: `bug-`
- Feature request: `request-`
- Unified stabilization issue: `issue-`
- Test session: `session-`
- Observation: `observation-`
- Verification: `verification-`
- Sign-off: `signoff-`

## Completion Rule

A register item may be marked complete only when its evidence field or notes explain what was verified.

## Required Unified Issue Fields

Every item in `registers/stabilization-issues.json` must support:

- `issueId`
- `date`
- `testerId`
- `deviceId`
- `version`
- `category`
- `severity`
- `description`
- `expectedBehavior`
- `actualBehavior`
- `subsystemOwner`
- `status`
- `regressionVerified`
- `resolvedVersion`
- `testerVerification`

## Required Observation Types

Observation records must use one of:

- `positive_feedback`
- `workflow_observation`
- `route_quality_observation`
- `performance_observation`

## Administration Boundary

Intake records may route work to other subsystems, but they must not implement product, data, infrastructure, CRM, Companion, Website, Social Media, Research, Sales, or Mobile changes.
