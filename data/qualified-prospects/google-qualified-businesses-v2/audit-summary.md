# Google Places Refresh Engine v1 Audit

Generated: 2026-06-30T03:02:47.845Z
Dataset: google-qualified-businesses-v2

## Audit Summary

- Existing records loaded: 245
- Existing records refreshed by Place ID: 245
- New discovered records added: 222
- Addresses updated: 0
- Place IDs updated or recovered: 0
- Permanently closed businesses removed: 0
- Duplicate records removed: 313

## Quality Report

- Total discovered: 518
- Verified: 398
- Rejected: 52
- Missing addresses: 4
- Missing Place IDs: 0
- Closed businesses removed: 0
- Final production candidate count: 398
- Founder 15-mile production pool: 397
- Anthony 25-mile production pool: 398

## Quality Gates

- do_not_recommend: 37
- generic_or_restricted: 37
- missing_numbered_address: 4
- invalid_business_name: 12

## Files

- data/qualified-prospects/google-qualified-businesses-v2/google-qualified-businesses-v2.csv
- data/qualified-prospects/google-qualified-businesses-v2/google-qualified-businesses-v2.json
- data/qualified-prospects/google-qualified-businesses-v2/founder-15-mile-pool.json
- data/qualified-prospects/google-qualified-businesses-v2/anthony-25-mile-pool.json
- data/qualified-prospects/google-qualified-businesses-v2/runtime-pools.json
- data/qualified-prospects/google-qualified-businesses-v2/rejected-records.json
- data/qualified-prospects/google-qualified-businesses-v2/quality-report.json
- data/qualified-prospects/google-qualified-businesses-v2/audit-summary.md

## Runtime Google API Verification

Run:

```bash
npm run verify:zero-google-api
```

