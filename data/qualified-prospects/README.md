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

When a Google Places API key is available:

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
