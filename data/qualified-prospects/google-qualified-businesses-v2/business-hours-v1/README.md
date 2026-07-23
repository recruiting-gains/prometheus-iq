# Route IQ Business Hours Enrichment and Closed-Now Data Contract v1

Owner: Prometheus Data

Status: governed Data foundation implemented; the exact v2 Fitness Connection Intelligence consumer is verified for fail-closed route availability.

## Root Cause

The existing production dataset correctly separated permanently closed businesses from operational businesses, but it did not store regular hours, current opening hours, special hours, timezone, or freshness. Google Places `businessStatus: OPERATIONAL` means the establishment remains in business; it does not mean the establishment is open at the current date and time.

Founder field evidence from July 11, 2026 identified the failure at Christian Brothers Automotive Pearland, 9245 S Sam Houston Pkwy E, Houston, TX 77075. Its existing verified Google Place ID is `ChIJiduac7LCQIYR-sGBtIAjKR0`. The ID was reused from the production dataset and was not inferred.

## Architecture

`scripts/refresh-google-business-hours.mjs` is an offline or scheduled batch process. It reads verified business identities from `google-qualified-businesses-v2.json`, fetches Place Details by the existing Google Place ID, normalizes structured hours, evaluates a deterministic status in the business-local timezone, and atomically writes `business-hours.json`.

The representative route-generation runtime makes no provider call. The verified `route-iq-business-hours-eligibility-v2` runtime and `route-iq-business-hours-eligibility-contracts-v2` consumer may read the governed artifact for Fitness Connection initial route generation, adaptive replenishment, and explainability. The Data quality gate requires both exact identifiers and rejects the superseded v1 runtime and contract. Intelligence owns final route eligibility and ranking and may not mutate Data artifacts.

Consumer admission is derived from `administration/workspace-configurations/route-iq-cross-industry-workspaces-v2.json` and `data/route-iq-commercial-readiness-v1/route-iq-workspace-business-artifact-manifest-registry-v1.json`. Workspace, operating profile, territory, manifest identity, artifact hash, classification, approval state, and configuration provenance must agree before a candidate can enter route evaluation.

Provider refresh:

```bash
npm run data:business-hours:refresh
```

Readiness check without provider calls or writes:

```bash
npm run data:business-hours:dry-run
```

Offline status reevaluation without provider calls:

```bash
npm run data:business-hours:evaluate
```

Recommended schedule:

- Provider hours refresh every 24 hours.
- Offline status reevaluation every 15 minutes.
- Provider hours remain fresh for at most 24 hours.
- Point-in-time field observations remain current for at most 240 minutes and are corroborating evidence, not a weekly schedule.

No provider-refresh scheduler is deployed by this Data task. Consumer authorization is limited to the already verified Intelligence contract and does not authorize any other subsystem or workspace.

## Status Model

- `OPEN_VERIFIED`: fresh provider periods show the business open at the evaluated business-local date and time.
- `CLOSED_VERIFIED`: fresh provider periods show the business closed at the evaluated business-local date and time.
- `HOURS_UNKNOWN`: hours, timezone, or verified source evidence is missing.
- `HOURS_STALE`: the last verified hours exceed the explicit 24-hour freshness threshold.
- `SPECIAL_HOURS_UNVERIFIED`: a special or holiday date is known but its exceptional hours are not verified.

Missing values remain `null`. They are never converted to `false`, `0`, open, or closed.

## Time Evaluation

The evaluator uses the provider IANA timezone, including `America/Chicago`, and evaluates:

- Business-local day of week and time.
- Weekly periods.
- Overnight periods that cross midnight or the weekly boundary.
- Dated current-opening-hours periods.
- Verified and unverified special dates.
- Source freshness before interpreting any periods.

Permanent status remains in `permanentOperationalStatus`; current time eligibility evidence remains in `currentOpenClosedEligibilityStatus`.

## Persistence and Fail-Closed Rules

- Writes use a temporary file followed by an atomic rename.
- A missing provider binding fails before any artifact write.
- An unknown workspace fails before any provider call or write.
- A failed record refresh preserves the previous verified schedule, timestamps, and provenance, records `lastFailedRefreshAt`, and reevaluates freshness.
- A first-time failed refresh produces `HOURS_UNKNOWN`; it does not invent hours.
- Every record is scoped to `fitness_connection` / `fitness`; exact workspace and operating-profile matching deny all cross-workspace consumption.
- The launch freshness ceiling is 24 hours.
- Evaluation and dry-run modes are non-mutating unless the caller supplies the explicit `--write` flag.

## Canonical Handoff

The Data-to-Intelligence handoff contract is:

`overwatch/artifact-contracts/data/fitness-connection-business-hours-data-contract-v1.json`

The Data artifact contract and exact v2 Intelligence consumer apply the verified conservative, explainable policy:

- Known closed businesses may be suppressed when qualified verified-open alternatives exist.
- Known open businesses remain eligible for Intelligence evaluation.
- Unknown, stale, and unverified special hours require separate conservative handling.
- Every exclusion or uncertainty must retain the Data status and reason code.

This Data authorization does not modify Intelligence runtime logic, route scores, or the business-hours dataset.

## Provider Reference

The refresh uses Google Places API (New) Place Details with an explicit field mask for `id`, identity, permanent business status, IANA timezone, regular opening hours, and current opening hours. Google documents `OPERATIONAL` as not necessarily open now and documents opening-hour periods in the place-local timezone.

- https://developers.google.com/maps/documentation/places/web-service/place-details
- https://developers.google.com/maps/documentation/places/web-service/reference/rest/v1/places
