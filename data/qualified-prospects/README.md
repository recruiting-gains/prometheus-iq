# Qualified Prospects Seed Database

Purpose: provide Prometheus IQ with verified storefront prospects for rep-specific discovery routes.

Base location:
- Fitness Connection Almeda
- 12338 Gulf Freeway, Houston, TX 77034
- Maximum inventory radius: 20 miles
- Anthony first-route target radius: 0-10 miles

## Files

- `qualified-prospects.schema.json`: required fields and allowed values for prospect records.
- `anthony-almeda-qualified-prospects.seed.json`: seed manifest and Anthony routing rules.
- `anthony-almeda-200-slot-import-template.csv`: 200-slot import template. These rows are placeholders only and must not be treated as real businesses.

## Required Rule

Prometheus must never pretend placeholders or generic places are qualified prospects.

Every real business row must include:
- Business name
- Full address
- Category
- Estimated distance from 12338 Gulf Freeway
- Access type
- Who to ask for
- Source
- Source type
- Rep status
- Shared approval
- Recommendation for Anthony
- Quality status

## Anthony First Route Rules

Anthony's first route must:
- Use only `rep_status = Anthony unvisited`
- Use only `recommendation_for_anthony = yes`
- Avoid Cruz historical winners
- Avoid Urban Bird Hot Chicken
- Avoid AutoZone Auto Parts - Seaford Dr
- Avoid generic malls, plazas, park-and-rides, schools, airports, government buildings, and broad hospital campuses
- Stay inside 0-10 miles when at least 25 qualified fresh options exist
- Expand to 15 miles only when fewer than 25 fresh options exist inside 10 miles
- Use 20 miles only as reserve inventory
- Include category diversity

## Building Anthony's Route From a Real Import

After replacing placeholder rows with verified prospect rows, run:

```bash
node scripts/build-qualified-prospect-routes.mjs data/qualified-prospects/anthony-almeda-200-slot-import-template.csv
```

The output will be written to:

```text
data/qualified-prospects/anthony-almeda-route-output.json
```

## Google Maps / Places Refresh Workflow

When a Google Places API key is available locally, use the backend-only discovery pipeline. Do not put the key in frontend code, do not commit it, and do not paste it into any public file.

Setup:

```bash
cp .env.example .env
```

Then add the key locally inside `.env`:

```text
GOOGLE_MAPS_API_KEY=your_real_key_here
```

Run a readiness check:

```bash
node scripts/discover-google-qualified-prospects.mjs --dry-run
```

Run live Google discovery:

```bash
node scripts/discover-google-qualified-prospects.mjs
```

Default outputs:

```text
data/qualified-prospects/google-discovered-prospects.csv
data/qualified-prospects/anthony-google-route-preview.json
data/qualified-prospects/google-discovery-readiness-report.json
```

This pipeline uses Google Geocoding API to verify the base address and Google Places Text Search to collect individual business candidates by category. The API key is read server-side/local-only from `.env`.

## Versioned Google Places Refresh Engine

Use the refresh engine for production-ready offline datasets. It refreshes existing Google Place IDs, discovers new businesses, removes permanently closed businesses, applies strict route-quality gates, and writes a versioned dataset without overwriting historical files.

Dry run:

```bash
npm run data:refresh-google:dry-run
```

Generate the v2 dataset:

```bash
npm run data:refresh-google
```

Default versioned outputs:

```text
data/qualified-prospects/google-qualified-businesses-v2/google-qualified-businesses-v2.csv
data/qualified-prospects/google-qualified-businesses-v2/google-qualified-businesses-v2.json
data/qualified-prospects/google-qualified-businesses-v2/founder-15-mile-pool.json
data/qualified-prospects/google-qualified-businesses-v2/anthony-25-mile-pool.json
data/qualified-prospects/google-qualified-businesses-v2/runtime-pools.json
data/qualified-prospects/google-qualified-businesses-v2/rejected-records.json
data/qualified-prospects/google-qualified-businesses-v2/quality-report.json
data/qualified-prospects/google-qualified-businesses-v2/audit-summary.md
```

If v2 already exists and must be regenerated intentionally:

```bash
node scripts/refresh-google-qualified-businesses.mjs --force
```

Quality gates enforced by the versioned refresh:

- Google Place ID required.
- Numbered street address required.
- Verified business name required.
- Safe Google Maps directions URL required.
- Generic/restricted locations excluded.
- Permanently closed businesses removed.

Verify that normal app runtime still makes zero live Google API calls:

```bash
npm run verify:zero-google-api
```

## Business Hours Enrichment

Business hours are refreshed separately from business identity and pool segmentation. The batch process uses verified production Place IDs, stores regular/current/special hours with IANA timezone and provenance, and never calls Google from representative route-generation runtime.

Readiness check without provider calls or writes:

```bash
npm run data:business-hours:dry-run
```

Scheduled provider refresh:

```bash
npm run data:business-hours:refresh
```

Offline status reevaluation without provider calls:

```bash
npm run data:business-hours:evaluate
```

The canonical artifact is `google-qualified-businesses-v2/business-hours-v1/business-hours.json`. Missing hours produce `HOURS_UNKNOWN`, stale hours produce `HOURS_STALE`, and unverified special hours produce `SPECIAL_HOURS_UNVERIFIED`. Permanent operational status remains separate from current open/closed status. The contract authorizes only the verified Fitness Connection `route-iq-closed-now-eligibility-contracts-v1` Intelligence consumer and does not permit scoring changes, live Google runtime calls, Data mutation, or cross-workspace use.

## Runtime Pool Segmentation

After a verified refresh exists, segment the runtime dataset without changing Route Intelligence scoring or Dashboard behavior:

```bash
node scripts/segment-google-runtime-pools.mjs
```

Default segmentation outputs:

```text
data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/active-pool.json
data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/reserve-pool.json
data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/quarantine-pool.json
data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/runtime-pool-manifest.json
data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/segmentation-report.md
```

Segmentation rules:

- Active: production-safe verified businesses with existing runtime quality class `Excellent` or `Good`.
- Reserve: production-safe verified businesses with existing runtime quality class `Average` or `Poor`.
- Quarantine: failed gates, duplicate Place IDs, generic businesses, missing numbered addresses, invalid directions, closed businesses, corrupt/unverified records, or existing runtime quality class `Never Visit`.

## Runtime Pool Refresh Governance

Before any refreshed runtime pool is released for Dashboard consumption, run the governance gate:

```bash
node scripts/govern-runtime-pool-refresh.mjs
```

The first approved baseline for a new segmentation version is created explicitly:

```bash
node scripts/govern-runtime-pool-refresh.mjs --update-baseline
```

Default governance outputs:

```text
data/qualified-prospects/google-qualified-businesses-v2/runtime-governance-overrides.json
data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/governance-baseline.json
data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/governance-report.json
data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/governance-report.md
data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/promotion-gate.json
```

Governance fails closed. If validation fails, `promotion-gate.json` sets `promotionAllowed` to `false` and the dataset must not be promoted through the Dashboard data export path.

`runtime-governance-overrides.json` is reserved for field-verified unsafe records that Google may still classify as valid operational businesses. The current override quarantines the `10820 Hughes Rd` barber-shop cluster after Anthony reported it as a residential house instead of a production-safe storefront stop.

Governance tests:

```bash
node scripts/test-runtime-pool-governance.mjs
```

## Google Deployment Verification Notes

Before sending a Google-powered route to a tester:

- Verify the local `.env` exists and is ignored by Git.
- Verify Google Geocoding works for the base address.
- Verify Google Places returns real individual businesses, not only generic areas or broad campuses.
- Verify the generated route output is the same data source used by the dashboard package being tested.
- Verify the live beta URL displays the Google-qualified route, not an older static/manual route.
- Verify no Google API key, request URL containing a key, `.env` value, or credential appears in committed files, screenshots, browser code, or deployment output.

## Territory And ZIP Planning

For future multi-location pilots:

- Define a base address per location.
- Define a primary ZIP code cluster and reserve radius per location.
- Keep discovery pools separate by rep and territory.
- Avoid merging one rep's route history into another rep's learning profile.
- Re-run Google discovery when a territory changes or when the route pool becomes stale.
- Review manager-accessibility and walk-in suitability before approving a territory route.

## Route Intelligence Review Notes

Current strengths:

- Discovery can start from real Google Places data.
- Filtering separates walk-in-ready locations from restricted or generic targets.
- Anthony can receive a route that does not inherit Cruz's historical route as his own.

Current weaknesses:

- Google data alone does not prove decision-maker availability, parking quality, or likelihood of conversation.
- Category quality still needs field feedback to become truly personalized.
- The first route can be intelligently ranked, but confidence should remain conservative until Anthony records visits, conversations, leads, and outcomes.

Highest-ROI improvement using the existing architecture:

- Capture Anthony's feedback after every visit and update category confidence, visit quality, and route freshness from verified outcomes instead of relying only on Google business metadata.

Manual Google workflow, if needed:

1. Search around `12338 Gulf Freeway, Houston, TX 77034`.
2. Pull specific storefront results, not plazas or broad areas.
3. Run multiple category searches:
   - bookstore
   - smoke shop
   - vape shop
   - electronics store
   - phone repair
   - pawn shop
   - small business near Almeda Genoa
   - storefront near Gulf Freeway
   - auto repair
   - tire shop
   - oil change
   - car wash
   - tax office
   - barber shop
   - hair salon
   - restaurant
   - apartment leasing office
   - medical office
   - dental office
   - business services
   - small retail
4. Save each individual storefront as its own row.
5. Mark big-box, restricted, campus, and generic locations as `Do not recommend` unless permission is confirmed.
6. Mark the source as `Google Places API`.
7. Set `quality_status = verified` only when the record has a real name and full address.
8. Run the route builder script.

## Manual Verification Workflow When Google Places API Is Unavailable

Google Places API is currently not configured in this repository. Until it is available, use this manual workflow:

1. Open Google Maps.
2. Search from the base address: `12338 Gulf Freeway, Houston, TX 77034`.
3. Use one category search at a time.
4. Open each result and verify it is an individual storefront or specific business.
5. Do not add generic plazas, shopping centers, malls, campuses, or broad areas.
6. If a business sits inside a plaza or shopping center, add the individual business only.
7. Copy the exact business name and full address into the CSV.
8. Add the category.
9. Estimate distance from Fitness Connection using Google Maps directions.
10. Set access type:
    - `Walk-in ready` for normal storefronts where a rep can reasonably ask for a manager, owner, shift lead, leasing manager, or office manager.
    - `Permission required` for large employers, event venues, schools, hospitals, plazas, malls, or any location where outreach may need approval.
    - `Event-based` for verified events or vendor opportunities.
    - `Do not recommend` for big-box stores or restricted locations unless approval exists.
11. Set `source_type = Google Maps` for manually verified Google Maps records.
12. Set `quality_status = verified` only after name and address are confirmed.
13. Set `rep_status = Anthony unvisited`.
14. Set `recommendation_for_anthony = yes` only if the location is a realistic stop for Anthony.
15. Run the route builder script and review the verification report.

Suggested manual search list:

- bookstore near 12338 Gulf Freeway Houston TX
- smoke shop near 12338 Gulf Freeway Houston TX
- vape shop near 12338 Gulf Freeway Houston TX
- electronics store near 12338 Gulf Freeway Houston TX
- phone repair near 12338 Gulf Freeway Houston TX
- pawn shop near 12338 Gulf Freeway Houston TX
- small business near Almeda Genoa Houston TX
- car wash near 12338 Gulf Freeway Houston TX
- tax office near 12338 Gulf Freeway Houston TX
- medical office near 12338 Gulf Freeway Houston TX
- dental office near 12338 Gulf Freeway Houston TX
- apartments near 12338 Gulf Freeway Houston TX
- restaurant near 12338 Gulf Freeway Houston TX
- hair salon near 12338 Gulf Freeway Houston TX
- barber shop near 12338 Gulf Freeway Houston TX
- oil change near 12338 Gulf Freeway Houston TX
- tire shop near 12338 Gulf Freeway Houston TX
- auto repair near 12338 Gulf Freeway Houston TX
- storefront near Gulf Freeway and Almeda Genoa Houston TX

Anthony's route must not be generated until verified records exist.

## Public Map Fallback Used On 2026-06-22

Because Google Places API was unavailable, a public OpenStreetMap / Overpass export was used as a temporary seed source.

Files:

- `overpass-anthony-almeda.query`
- `overpass-anthony-almeda.raw.json`
- `anthony-almeda-verified-prospects.csv`
- `anthony-almeda-route-output.json`

Important:

- These records are public map records, not Google Places records.
- Before sending Anthony into the field, review the first route for real-world suitability.
- Any hospital, school, airport, government, big-box, grocery-chain, mall, plaza, or restricted site must be treated as permission required or not recommended.
- Google Maps links are generated as search links for navigation convenience; they are not proof that the source was Google Places.

No source code, scoring formula, or proprietary route logic should be sent to outside users.
