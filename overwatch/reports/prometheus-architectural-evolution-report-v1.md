# Prometheus Architectural Evolution Report

## Current Product

Route IQ is Prometheus's sole active product. Gaia remains paused and Athena remains architecture-only.

Route IQ is a configuration-driven platform for field organizations. Prometheus Administration defines workspaces, companies, operating profiles, roles, users, territories, card fields, actions, outcomes, KPIs, availability rules, and approved business sources. Reusable Dashboard and PWA components do not branch on customer names.

## Current Architecture

The governed path is:

`authenticated session -> Administration configuration -> Data manifest -> normalized availability -> Intelligence eligibility -> Infrastructure projection -> Dashboard`

Data owns approved business rosters, evidence, freshness, provenance, exclusions, pools, and retention. Intelligence consumes only admitted records and determines whether an opportunity can be an immediate route stop. Infrastructure projects canonical artifacts without changing identity or eligibility. Dashboard renders the authenticated role and workspace.

## Verified Configurations

Fitness Connection is isolated Founder field research, not a customer, partner, sponsor, endorsement, or committed pilot.

Northstar Field Supply is a synthetic outside-sales configuration used only to prove that another industry can use the same PWA without customer-specific application code.

## Availability

Business availability uses business-local time zones, weekly and special schedules, overnight and split periods, 24-hour operations, appointment/access windows, source provenance, verification timestamps, and a maximum 24-hour freshness ceiling.

Fresh verified-open records or verified current access windows may be immediately eligible. Closed, stale, missing, invalid, provider-failure, and unverified appointment records fail closed. Operating hours and estimated visit duration remain separate.

The current Founder-research data is intentionally quarantined because its hours are stale or unavailable. No open status is inferred.

## Runtime And Cache Boundary

The generic PWA requires four exact runtime assets:

- `workspaceConfiguration`
- `businessManifestRegistry`
- `businessRoster`
- `businessHours`

Governed assets are network-only. Service-worker and browser-storage versions migrate explicitly so stale customer catalogs cannot survive a release transition.

## Safety

- Collection: `OFF`
- Active cohorts: `0`
- Recommendation influence: `OFF`
- Anthony Founder mapping: `UNMAPPED`
- Production scheduler: not activated
- External provider credentials: not added
- Production deployment and migration: separately Founder-gated

Historical Git remains immutable. Retired customer-specific files are removed from the current deployable tree rather than rewritten from history.
