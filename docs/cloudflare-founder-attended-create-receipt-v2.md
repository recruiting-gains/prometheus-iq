# Cloudflare Founder-Attended Create-Receipt Classification v2

Owner: Prometheus Infrastructure

Batch: `BATCH-20260715-004`

Status: implemented in source; no live action performed

## Purpose

This v2 extension classifies a future Cloudflare Access service-token create response without retaining or emitting response material. It preserves the v1 implementation and local artifacts, uses the separate local namespace `$HOME/.prometheus/infrastructure/cloudflare-founder-attended-create-receipt-v2`, and does not add package or Overwatch release wiring.

The earlier generic create-response failure cannot be reconstructed safely because the response body and credentials were intentionally not retained. A future attended attempt will append only closed, nonsecret reason codes that identify the first rejected contract dimension.

## Official Contracts

The implementation was checked on 2026-07-15 against the current official Cloudflare API references:

- [Create a service token](https://developers.cloudflare.com/api/resources/zero_trust/subresources/access/subresources/service_tokens/methods/create/)
- [Delete a service token](https://developers.cloudflare.com/api/resources/zero_trust/subresources/access/subresources/service_tokens/methods/delete/)
- [List service tokens](https://developers.cloudflare.com/api/resources/zero_trust/subresources/access/subresources/service_tokens/methods/list/)

The create endpoint returns HTTP 200. Its result and individual result fields are optional in the schema. Prometheus therefore requires a result object, a syntactically bounded resource ID, documented Client ID form, bounded non-whitespace Client Secret, and valid documented timestamps when present. The `name` and `duration` response echoes may be omitted, but contradictory echoes fail closed.

Omitted echoes are never accepted on the fixed request alone. Before credentials can be stored, a bounded exact-name GET must prove exactly one record whose returned resource ID matches the create response and whose duration is exactly `720h`. Missing, malformed, ambiguous, mismatched, or duplicate proof ends in `MANUAL_REVIEW` with no DELETE.

## Lifecycle

1. A native controlling-TTY phrase is required before Keychain reads, network access, or local control writes.
2. A fresh exact-name GET must prove absence.
3. A separate attended action creates a fresh one-shot control in the v2 namespace.
4. A separate attended action consumes that control before exactly one POST can occur.
5. The create response is classified to one or more fixed reason codes; response data is not persisted.
6. A bounded GET uniquely binds exact name, `720h`, and the ID returned by that POST.
7. Valid credentials are stored as an all-or-rollback Keychain pair.
8. If validation or storage fails after unique proof, a second native-TTY phrase is required before one bounded DELETE can be attempted.
9. Cleanup is complete only after the delete contract validates and a follow-up exact-name GET proves absence.

The compensation target is held only in process memory and comes from the one POST consumed by the fresh control. A wrong-name response, wrong-duration response, unproven ID, or duplicate exact-name result is never eligible for automated compensation.

## Evidence Boundary

Create classifications are append-only `0600` files in a `0700` v2 directory. Their contents are limited to the reason-code vocabulary in `cloudflare-founder-attended-create-receipt-v2-constants.mjs`. Existing phase evidence remains limited to its closed v1 vocabulary. Neither evidence stream may contain credentials, account identifiers, response bodies, headers, cookies, prefixes, lengths, or hashes derived from response credentials.

The temporary provisioning API token remains present. Source implementation and tests do not call Cloudflare, read the real Keychain, create a real control, write credentials, delete a service token, deploy, or mutate production.

## Future Executable Paths

- Fresh-control adapter: `scripts/run-cloudflare-founder-attended-create-receipt-v2-prepare.mjs`
- Repaired provisioning adapter: `scripts/run-cloudflare-founder-attended-create-receipt-v2-provision.mjs`

Both adapters use the v2 namespace. The provisioning adapter calls only the v2 workflow and its guarded transport enforces exact request shapes, one POST, one DELETE, and no retry. Neither adapter was executed by this batch.

## Next Safe Command

The only currently authorized next laptop action is the new Founder-attended GET-only absence diagnostic:

```sh
node scripts/run-cloudflare-founder-attended-create-receipt-v2-get-only.mjs
```

It cannot create or delete a remote resource. Control preparation and provisioning remain later, separately authorized attended boundaries.
