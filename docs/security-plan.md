# Prometheus Security Plan

## Current Local App

Prometheus currently has no backend. Data is stored in the browser on one device.

- Rep and Owner are interface modes, not authenticated roles.
- Do not store passwords, payment information, medical information, Social Security numbers, or sensitive customer records.
- Backup imports are size-limited, validated, normalized, and stripped of unsafe identifiers and control characters.
- Dynamic user content must be escaped before entering HTML.
- Offline caching is restricted to same-origin Prometheus files.

## Private Beta Requirements

The cloud beta is not ready until all of these controls are implemented and tested:

1. Email-based authentication with verified accounts and password reset.
2. Server-controlled organization membership and `owner` or `rep` roles.
3. Row-level database security that defaults to denying access.
4. Reps can read and edit only their permitted organization data.
5. Owners can view organization reports but cannot access another company.
6. Role changes can only be performed by an authorized server operation.
7. The database service-role key is never shipped to the browser.
8. HTTPS is required for every production request.
9. Input validation and numeric limits are repeated on the server.
10. Login, import, and write operations are rate-limited.
11. Production origins are allowlisted; permissive CORS is prohibited.
12. Daily backups are enabled and restore procedures are tested.
13. Owner actions and permission changes are recorded in audit logs.
14. Secrets are stored in the hosting provider's encrypted environment settings.
15. Error messages and logs exclude tokens, passwords, and customer data.
16. Account deletion, data export, retention, and incident-response procedures are documented.

## Release Gate

Before adding a coworker or business pilot:

- Test two organizations and prove that neither can access the other.
- Test owner and rep permissions with direct database requests, not only hidden buttons.
- Test expired sessions, password resets, revoked users, offline writes, duplicate synchronization, and backup restoration.
- Run automated dependency and secret scans.
- Review the data collected and remove fields that are not required for field-sales performance.

No system can be guaranteed vulnerability-free. Security is an ongoing release requirement, not a one-time feature.
