# Anthony Qualified Prospect Seed Plan

Date: 2026-06-22

## Current Status

Anthony's app experience is now protected from Cruz's first-route contamination:

- Urban Bird Hot Chicken is blocked from Anthony's first route.
- AutoZone Auto Parts - Seaford Dr is blocked from Anthony's first route.
- Dynamic Cruz historical winners are blocked from Anthony's first route.
- Anthony's first route uses Anthony-unvisited places only.
- Anthony's first route stays within 0-10 miles when enough qualified options exist.
- Generic and restricted locations remain filtered by Route Intelligence v4.1.

## Real Prospect Data Status

No verified Google Maps / Places export is currently present in the repository.

Because of that, Prometheus should not claim to have a real 200-business Anthony seed database yet.

The import structure is ready:

- `data/qualified-prospects/qualified-prospects.schema.json`
- `data/qualified-prospects/anthony-almeda-qualified-prospects.seed.json`
- `data/qualified-prospects/anthony-almeda-200-slot-import-template.csv`
- `scripts/build-qualified-prospect-routes.mjs`

## Anthony First Route Output

The current placeholder template produces:

- Qualified records: 0
- Anthony first route: 6 after verified records are imported
- Anthony backup queue: 0

This is intentional. Prometheus must not create fake routes from placeholder records.

## Next Step

Load verified storefront data from Google Maps / Places API, a manually verified Google Maps export, or a human-reviewed storefront list.

After real records are added, run:

```bash
node scripts/build-qualified-prospect-routes.mjs data/qualified-prospects/anthony-almeda-200-slot-import-template.csv
```

Then review:

```text
data/qualified-prospects/anthony-almeda-route-output.json
```

Only records with `recommendation_for_anthony = yes`, `rep_status = Anthony unvisited`, and `quality_status = verified` should be used for Anthony's first beta route.

## 2026-06-22 Verified Route Review

Google Places API was not configured, so the route was generated from public OpenStreetMap / Overpass records with names, addresses, and coordinates.

Verification counts:

- Verified records: 220
- Excluded records: 33
- Permission-required records: 33
- Anthony-ready records: 187
- Qualified records: 187
- Anthony first route: 6
- Backup discovery queue: 181

Final first route:

1. Big Star Honda
2. Discount Tire
3. BreWingZ Restaurant and Bar
4. Mari's Hair Design
5. Marconi Dental Aesthetics - Pasadena, TX
6. Vape City

Review decision: pass for controlled beta use after founder common-sense review. Data source is public map data, not Google Places, so Anthony should still verify hours, access, and manager availability before outreach.
