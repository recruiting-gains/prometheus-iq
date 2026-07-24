# Route IQ Multi-Company Runtime Infrastructure v1

Owner: Prometheus Infrastructure

This package adds a stateless, private-Worker runtime boundary for explicit workspace selection and ZIP coverage. It does not create a second authorization registry.

## Workspace selection

`GET` or `HEAD` requests may signal one strict opaque `workspaceId`. Infrastructure passes that value, the verified principal digest, and the launch envelope to Data-owned `authorizeRouteIqAugust1LaunchPrincipal`. Data must prove the requested workspace belongs to the exact authenticated Founder's server-side allowlist. Infrastructure then requires the returned workspace to equal the request.

Representatives remain bound to their Data-authorized workspace, profile, user, representative, role, and Administration territory assignment. The runtime exposes no workspace-list endpoint, returns the same fixed error surface for rejected selections, and never authorizes from a display name or caller identifier. Anthony remains unmapped.

Each successful browser session still represents exactly one workspace and exactly four runtime assets:

- `workspaceConfiguration`
- `businessManifestRegistry`
- `businessRoster`
- `businessHours`

## ZIP projection

Infrastructure consumes the canonical Administration registry and its ownership-bearing `territories[].zipCoverage` objects after Data has authorized the exact workspace. Each coverage object must carry the matching `coverageVersion`, `workspaceId`, `companyId`, and `territoryId`; postal coverage comes only from `zipCoverage.postalCodes`. Postal codes must be unique US five-digit values. Territory IDs and postal codes must be unique inside the workspace. Missing, malformed, duplicate, cross-owner, cross-workspace, cross-user, inactive, or unauthorized coverage fails closed.

The Data-authorized Founder read-only mode may project all active territories only after the canonical Administration Founder boundary confirms the selected workspace. Representatives remain limited to the exact Administration user and territory assignment. The ZIP projection remains server-internal; it supplies territory authorization to Infrastructure runtimes without widening the exact four-asset client session contract or hard-coding any business identity.

## 72-hour evidence

`buildRouteIq72HourOnboardingRuntimeEvidence` records automated configuration time separately from human input, credentials, availability verification, and attended mobile acceptance. It cannot mark the 72-hour standard proven while any external or attended step remains.

## Later availability activation

The current boundary remains active `0`, reserve `0`, quarantine `398`; providers and the scheduler remain OFF. A later, separately authorized activation must occur in this order:

1. Founder approves the exact production business manifest.
2. Founder authorizes the provider and protected credential provisioning.
3. Infrastructure binds the authorized Prometheus Data producer.
4. Data accepts and verifies the initial normalized snapshot with no more than 24 hours of freshness.
5. Founder authorizes the daily scheduler and monitoring.
6. Data validates eligibility and moves only fresh approved records into active or reserve pools.

Provider failure, missing credentials, stale evidence, invalid ZIP coverage, or incomplete monitoring keeps records quarantined and route-ineligible. No deployment, provider, credential, scheduler, migration, cache purge, or production mutation is authorized by this package.

The existing private forward rollback v3 remains compatible without a contract mutation: it forces the customer PWA launch OFF and exposes no customer PWA routes, so multi-company selection and canonical ZIP projection are unreachable. It preserves the private-only target, existing stateful classes, bindings, migrations, namespaces, and secrets.
