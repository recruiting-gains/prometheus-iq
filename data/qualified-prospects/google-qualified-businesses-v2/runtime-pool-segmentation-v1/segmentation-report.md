# Runtime Pool Segmentation v1

Generated: 2026-07-23T12:00:00.000Z
Source dataset: google-qualified-businesses-v2
Segmentation version: runtime-pool-segmentation-v1

## Counts

- Active: 0
- Reserve: 0
- Quarantine: 398
- Audited production records: 398
- Noncanonical rejected sources projected: 0

## Rules

- Active: verified production-safe runtime businesses with existing quality class Excellent or Good.
- Reserve: verified production-safe runtime businesses with existing quality class Average or Poor.
- Quarantine: failed gates, duplicate Place IDs, generic businesses, missing numbered addresses, invalid directions, closed businesses, corrupt/unverified records, or existing runtime quality class Never Visit.

## Verification

- Active duplicate Place IDs: 0
- Reserve duplicate Place IDs: 0
- Active invalid records: 0
- Active/reserve overlap: 0
- Runtime behavior changed: false
- Scoring changed: false

## Files

- data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/active-pool.json
- data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/reserve-pool.json
- data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/quarantine-pool.json
- data/qualified-prospects/google-qualified-businesses-v2/runtime-pool-segmentation-v1/runtime-pool-manifest.json
