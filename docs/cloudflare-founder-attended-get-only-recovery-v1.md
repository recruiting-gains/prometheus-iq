# Cloudflare Founder-Attended GET-Only Failure Classification + One-Shot Recovery v1

## Status

- Batch: `BATCH-20260715-002`
- Owner: Prometheus Infrastructure
- Source status: `IMPLEMENTED_SOURCE_NOT_EXECUTED`
- Cloudflare API contacted: `false`
- Real Keychain values read: `false`
- Credential created, deleted, or changed: `false`
- Production mutated or deployed: `false`
- Temporary token cleaned up: `false`
- Pushed: `false`

This successor exists because the consumed predecessor receipt records authorization consumption but no network phase. The predecessor control, receipt, provisioning source, Overwatch governance, Overwatch verifiers, and Overwatch reports remain untouched. The successor uses a new artifact namespace and never deletes, replaces, or reuses either predecessor artifact.

## Current API Contract

The official current [List service tokens API contract](https://developers.cloudflare.com/api/resources/zero_trust/subresources/access/subresources/service_tokens/methods/list/) supplied for this batch defines `GET /accounts/{account_id}/access/service_tokens`, supports the `name`, `page`, and `per_page` query parameters used here, and marks both `result` and `result_info` optional. Every documented `result_info` member is also optional.

The parser therefore treats an omitted `result` as an empty result, accepts an omitted or partial `result_info`, and validates every present pagination member against the returned page and every prior page. Cloudflare defines `total_count` as the inventory total without search parameters, so it may bound but never dictate the exact-name filtered result count. Another bounded `GET` is allowed only after a full filtered page and consistent `total_pages` or `total_count` metadata proves that another page may exist. An empty or short filtered page terminates safely; a full page with no proof of completion or continuation fails closed. Contradictory metadata, malformed entries, a page count beyond the hard ceiling, or an entry whose name cannot be evaluated is `RESPONSE_CONTRACT_MISMATCH`. Any occurrence of the exact fixed name is `DUPLICATE_FOUND` and prevents preparation or creation.

## GET-Only Diagnostic

The dedicated diagnostic process imports no recovery-provisioning module. Its transport accepts only `GET`, rejects every other method before its HTTPS adapter, sends no request body, does not follow redirects, and does not retry. The URL is fixed to the governed account's service-token collection and has only:

- `name=Prometheus Overwatch Read-Only Smoke Verification`
- bounded `page`
- fixed `per_page=20`

The account ID comes only from the established governed Keychain item and must match the single source-controlled account digest before URL construction. The temporary token comes only from its established attended Keychain item. Neither value is accepted from argv, environment, stdin, a file, or user-controlled query input.

The production command requires the native controlling TTY and this exact phrase before any Keychain operation, network request, clock/repository sample, randomness request, or local artifact write:

`RUN GET-ONLY EXACT-NAME CLOUDFLARE DIAGNOSTIC FOR PROMETHEUS OVERWATCH READ-ONLY SMOKE VERIFICATION`

Its output is limited to these fixed classifications:

- `LIVE_STATE_FAILED`
- `NETWORK_FAILED`
- `AUTHORIZATION_DENIED`
- `VALID_EMPTY_RESULT`
- `DUPLICATE_FOUND`
- `RESPONSE_CONTRACT_MISMATCH`
- `SAFE_TO_PREPARE_RECOVERY`

A valid empty response emits `VALID_EMPTY_RESULT` followed by `SAFE_TO_PREPARE_RECOVERY`. A valid complete nonempty response with no exact-name match emits only `SAFE_TO_PREPARE_RECOVERY`. Output never includes response content, identifiers, account values, credentials, headers, prefixes, lengths, hashes, cookies, or Keychain values.

Only a successful absent-name diagnostic writes immutable local evidence under:

`$HOME/.prometheus/infrastructure/cloudflare-founder-attended-get-only-recovery-v1/diagnostics`

The owner-only evidence is bound to the governed account digest, fixed name, current clean commit and tree, a fresh nonce, and a maximum 30-minute window. Failed diagnostics write no evidence.

## Successor Control

Preparation is a separate local-only process. It has no transport, performs no Cloudflare request, and requires the native controlling TTY and this exact phrase before Keychain or control activity:

`PREPARE ONE LOCAL ONE-SHOT RECOVERY CONTROL AFTER THE SUCCESSFUL GET-ONLY DIAGNOSTIC`

It requires the temporary-token and governed-account names to remain present, both smoke names to remain absent, exactly one current unconsumed successful diagnostic, the same governed account binding, and the same current clean commit and tree. It atomically consumes that diagnostic evidence before exclusively creating:

`$HOME/.prometheus/infrastructure/cloudflare-founder-attended-get-only-recovery-v1/recovery-control.json`

The successor nonce must differ from the diagnostic nonce. The control is owner-only, expires in at most 30 minutes and no later than its diagnostic evidence, and has an append-only consumption receipt. Future consumption revalidates the control against that exact diagnostic evidence and its diagnostic-consumption receipt. Evidence replay, lineage changes, control replacement, and control replay fail closed. Nothing opens or mutates the predecessor `control.json` or its consumed-receipt directory.

## Later Provisioning

The later recovery source is implemented but was not executed by this batch. It is isolated from the diagnostic entrypoint and requires a third native-TTY confirmation:

`PROVISION ONE EXACT PROMETHEUS OVERWATCH READ-ONLY SMOKE SERVICE TOKEN USING THE SUCCESSOR RECOVERY CONTROL`

After confirmation and Keychain preflight, it requires the current clean bound repository, atomically consumes the fresh successor nonce, repeats the contract-aligned exact-name paginated `GET`, revalidates live state, and makes at most one fixed creation `POST` with no retry. An ambiguous create is manual review and can never be retried with the consumed control. A safely validated returned identifier may receive one compensating `DELETE`, matching predecessor failure semantics. The temporary token is never deleted by any successor path.

Do not run the later provisioning entrypoint as part of this handoff. No deploy, Access-policy mutation, credential cleanup, or push is authorized.

## Future Attended Commands

These fixed entrypoints accept no arguments or adapter injection. They are documented for a separately authorized Founder-attended session, not for implementation verification:

```bash
node scripts/run-cloudflare-founder-attended-get-only-diagnostic.mjs
node scripts/run-cloudflare-founder-attended-prepare-recovery.mjs
node scripts/run-cloudflare-founder-attended-successor-recovery.mjs
```

The root package is intentionally unchanged because existing Overwatch governance pins its predecessor release-wiring hash. The dedicated direct entrypoints avoid weakening that immutable predecessor gate.

## Safe Local Verification

These checks use synthetic Keychain and network doubles only. They do not invoke a production wrapper, contact Cloudflare, read real Keychain values, or access real predecessor controls/receipts:

```bash
node scripts/verify-cloudflare-founder-attended-get-only-recovery.mjs
node --test tests/cloudflare-founder-attended-service-token.test.mjs
```

The tests cover optional and empty fields, partial metadata, metadata-proven multiple pages, ambiguous full pages, contradictory counts and totals, the hard page ceiling, malformed bodies, authorization denial, network failure, duplicates on later pages, secret leakage, strict method denial, attendance ordering, successful-evidence gating, lineage changes, fresh nonces, maximum lifetime, predecessor-fixture immutability, diagnostic and control replay, temporary-token preservation, no create after a duplicate, at most one later create attempt, no retry, and bounded compensation.
