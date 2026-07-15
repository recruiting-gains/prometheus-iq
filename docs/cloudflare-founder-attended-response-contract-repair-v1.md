# Cloudflare Founder-Attended Service Token Response Contract Repair v1

## Status

- Batch: `BATCH-20260715-003`
- Owner: Prometheus Infrastructure
- Source status: `IMPLEMENTED_SOURCE_NOT_EXECUTED`
- Governed baseline: `d32ffd8f6ea255fa029976b1bf0006663d567153`
- Cloudflare API contacted: `false`
- Real Keychain values read: `false`
- Real successor control created: `false`
- Credential created, deleted, stored, or changed: `false`
- Temporary API token changed or removed: `false`
- Deployment or production mutation: `false`

Both prior one-shot controls are consumed historical artifacts. This repair does not read, reuse, replace, modify, or delete either predecessor control or receipt. It introduces a new artifact namespace and requires a fresh attended GET plus separate Founder authorization before a future successor control can exist.

## Official Response Contracts

The current official [create contract](https://developers.cloudflare.com/api/resources/zero_trust/subresources/access/subresources/service_tokens/methods/create/) returns HTTP `200`. Its documented result fields are optional, and the example includes `created_at` and `updated_at` without `expires_at`. The repaired validator therefore accepts omitted `expires_at`, accepts every documented timestamp when correctly formatted, and accepts omitted `errors` or `messages` envelope fields. It still requires all safety-critical values before any Keychain success:

- exact name `Prometheus Overwatch Read-Only Smoke Verification`
- exact duration `720h`
- safe returned resource ID
- valid service-token client ID
- valid service-token client secret

Missing credentials, a wrong name or duration, malformed timestamps, a non-`200` response, or an unsuccessful/ambiguous envelope fails closed. Credential values are never printed, logged, hashed, measured for reporting, or written to local evidence.

The current official [delete contract](https://developers.cloudflare.com/api/resources/zero_trust/subresources/access/subresources/service_tokens/methods/delete/) returns HTTP `200` with a service-token result object. The repaired validator accepts that documented object and its optional fields, validates every present identity, duration, and timestamp field, and never considers the cleanup complete from the delete response alone. A separate exact-name GET must prove absence. A valid delete response without absence proof remains `MANUAL_REVIEW`.

The current official [list contract](https://developers.cloudflare.com/api/resources/zero_trust/subresources/access/subresources/service_tokens/methods/list/) remains implemented by the bounded GET-only parser from the accepted predecessor: optional `result`, optional `result_info`, optional pagination members, fixed name/page/per_page, hard page ceiling, exact-name duplicate failure, and contradictory-response rejection.

## Fresh Successor Boundary

The new namespace is:

`$HOME/.prometheus/infrastructure/cloudflare-founder-attended-response-contract-repair-v1`

It does not contain or reference either predecessor path. The future sequence is deliberately separated:

1. Run the new diagnostic command under a native controlling TTY and enter its exact phrase. It performs only the governed exact-name GET. Only proven absence creates owner-only, maximum-30-minute diagnostic evidence.
2. In a separate attended action, run the preparation command and enter its different exact phrase. This consumes the new diagnostic evidence and exclusively creates a fresh one-shot control with a fresh nonce, current clean commit/tree, exact account binding, and maximum-30-minute lifetime.
3. Only after further Founder authorization, run the provision command and enter its third exact phrase. Consumption is written before network activity. The control can never retry after use, ambiguity, repository drift, or failure.

```bash
node scripts/run-cloudflare-founder-attended-response-contract-diagnostic.mjs
node scripts/run-cloudflare-founder-attended-response-contract-prepare.mjs
node scripts/run-cloudflare-founder-attended-response-contract-provision.mjs
```

These commands are future attended boundaries. They were not executed during implementation.

## One-Shot Lifecycle

After control consumption, the provisioner repeats the exact-name GET. Presence ends at `MANUAL_REVIEW` with zero POST attempts. Proven absence and unchanged clean repository state permit exactly one creation POST, with no retry.

A response that safely identifies the exact newly requested resource but fails full create validation may receive one compensating DELETE. Keychain storage failure also permits that bounded compensation. Cleanup reaches `COMPENSATED` only when both the documented delete response validates and the follow-up exact-name GET proves absence. Every ambiguity remains `MANUAL_REVIEW`; the consumed control cannot be used again.

The temporary API token is preserved in every path. Later removal or revocation requires successful replacement storage and verification plus explicit cleanup authorization.

## Append-Only Phase Evidence

Each future consumed control receives an owner-only directory of sequential, exclusive-create phase files. Every file contains exactly one approved nonsecret phase label:

`GET_COMPLETED`, `EXACT_NAME_ABSENT`, `EXACT_NAME_PRESENT`, `POST_ATTEMPTED`, `CREATE_RESPONSE_VALID`, `CREATE_RESPONSE_INVALID`, `KEYCHAIN_STORED`, `KEYCHAIN_NOT_STORED`, `DELETE_ATTEMPTED`, `DELETE_CONFIRMED`, `DELETE_NOT_CONFIRMED`, `SUCCESS`, `COMPENSATED`, or `MANUAL_REVIEW`.

The provisioning CLI exposes exactly the final `SUCCESS`, `COMPENSATED`, or `MANUAL_REVIEW` outcome. Evidence and CLI output contain no account IDs, client IDs, response bodies, headers, credentials, prefixes, lengths, hashes, cookies, or Keychain values.

## Safe Validation

These commands use source inspection and synthetic network/Keychain doubles only:

```bash
node scripts/verify-cloudflare-founder-attended-response-contract-repair.mjs
node --test tests/cloudflare-founder-attended-response-contract-repair.test.mjs
```

No test imports or invokes a production entrypoint, reads a real Keychain value, opens a real control path, or contacts Cloudflare.
