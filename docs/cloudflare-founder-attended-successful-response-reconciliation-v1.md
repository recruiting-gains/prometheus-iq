# Cloudflare Founder-Attended Successful-Response Reconciliation v1

Owner: Prometheus Infrastructure

Batch: `BATCH-20260715-005`

Status: implemented in source; no live action performed

## Purpose

This repair updates the existing create-receipt v2 workflow so a bounded HTTP `2xx` response is eligible for further validation without being treated as success by status alone. It preserves the current one-shot control, one-POST, no-retry, exact-proof, Keychain all-or-rollback, and separate-compensation boundaries.

The repair exists because observed live evidence showed a create attempt reached `MANUAL_REVIEW` through `CREATE_HTTP_STATUS_REJECTED` even though the exact token later appeared in Cloudflare and was manually deleted by the Founder. Prometheus therefore now treats any bounded `2xx` status as response-status eligible while still requiring the full success contract before credentials can be stored.

## Official Contracts

The implementation was checked on 2026-07-15 against the current official Cloudflare API references:

- [Create a service token](https://developers.cloudflare.com/api/resources/zero_trust/subresources/access/subresources/service_tokens/methods/create/)
- [List service tokens](https://developers.cloudflare.com/api/resources/zero_trust/subresources/access/subresources/service_tokens/methods/list/)
- [Delete a service token](https://developers.cloudflare.com/api/resources/zero_trust/subresources/access/subresources/service_tokens/methods/delete/)

Prometheus interprets those contracts as follows:

- The documented create status is HTTP `200`, but the schema marks `result`, `id`, `client_id`, `client_secret`, `name`, and `duration` optional.
- The list contract supports fixed `name`, `page`, and `per_page` query parameters, with `result` and `result_info` both optional.
- The delete contract documents HTTP `200` with a `ServiceToken` result object.

Prometheus extends only the response-status gate, not the success contract: any bounded `2xx` may continue into validation, but `SUCCESS` still requires a valid success envelope/body, valid Client ID, valid Client Secret, and the existing exact-name GET proof of the same returned resource ID, the fixed token name, and exact `720h` duration before Keychain storage.

## Reconciliation Rules

1. `CREATE_HTTP_STATUS_DOCUMENTED_200`, `CREATE_HTTP_STATUS_ALTERNATE_2XX`, or `CREATE_HTTP_STATUS_NON_2XX` is appended as the only persisted status evidence.
2. Alternate `2xx` is never success by itself.
3. Non-`2xx`, missing/invalid status, malformed body, or transport uncertainty never reach `SUCCESS`.
4. If the response cannot satisfy the credential-plus-proof contract, the consumed control remains fail-closed in `MANUAL_REVIEW`.
5. Compensation remains possible only when the existing workflow can uniquely prove the exact created token and the Founder separately authorizes one bounded delete.
6. No bodies, headers, cookies, credentials, account identifiers, or secret metadata are persisted.

## Next Safe Command

The only currently authorized next laptop action remains the Founder-attended GET-only reconciliation boundary:

```sh
node scripts/run-cloudflare-founder-attended-create-receipt-v2-get-only.mjs
```
