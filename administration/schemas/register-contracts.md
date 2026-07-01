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

## Completion Rule

A register item may be marked complete only when its evidence field or notes explain what was verified.
