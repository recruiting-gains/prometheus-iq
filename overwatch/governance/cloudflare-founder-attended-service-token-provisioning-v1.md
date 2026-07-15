# Cloudflare Founder-Attended Service Token Provisioning Governance v1

Batch: `BATCH-20260714-007`

Owner: Prometheus Overwatch

Status: `OWNER_REPAIR_VERIFIED_NOT_EXECUTED`

## Decision

Prometheus Infrastructure owns the local provisioning implementation. Overwatch owns this governance record, its independent verifier, the canonical registry entry, the batch report, and release-gate wiring. Overwatch did not modify the provisioning implementation.

The tool is attended-only. It cannot be launched by the unattended deployment launcher and requires the Founder on the controlling TTY, an exact confirmation phrase, a clean repository, a current commit and tree binding, and a persistent one-shot nonce consumed before any network request.

The initial Infrastructure implementation is preserved at `a0a1eb8e434015ea7a0f403e4be0a8979724d9a8`. Infrastructure independently repaired the live-state, native-helper, production-composition, and rollback boundaries in successor commit `214521d99d08a0a117d81e59b9ef38105edac147`. Overwatch records both commits and their exact evidence hashes; it does not claim retroactive repair in the initial commit.

## Fixed Scope

- API origin: `https://api.cloudflare.com`
- Path: `/client/v4/accounts/{account_id}/access/service_tokens`
- Account: the single governed Prometheus account, verified by pinned SHA-256 before endpoint construction
- Name: `Prometheus Overwatch Read-Only Smoke Verification`
- Duration: `720h`
- Create attempts: at most one
- Redirects and automatic retries: denied

No endpoint, account, name, duration, request body, credential, retry, force, or override argument is accepted from the user.

## Secret Boundary

The temporary Cloudflare API token and governed Account ID are separate macOS Keychain items. The existing unattended deployment token is outside this tool's readable registry. Created Access client values are passed to a Security.framework helper over anonymous standard input and stored directly under `com.prometheus.cloudflare.unattended.smoke`.

The native helper enforces the fixed operation/item matrix before every Security.framework item operation. The production entrypoint constructs its real TTY, clock, repository, Keychain, and transport adapters internally and exposes no adapter-injection surface. Test-only composition requires every dependency explicitly.

Verification is name-only. Values may not enter Git, environment files, persistent shell exports, command arguments, process listings, logs, reports, screenshots, browser storage, temporary files, or terminal output.

The Founder must manually verify the temporary API token's exact-account scope, sole `Access: Service Tokens Write` permission, and maximum 30-day expiry in Cloudflare. The local tool does not claim it can introspect provider-side token scope or expiry from the bearer value. Source compatibility with the audited `/usr/bin/security` reader is verified, but real Keychain ACL interoperability has not been executed and remains a mandatory Founder-attended readiness check.

## Failure Policy

Existing destination credentials, a duplicate remote name, replay, malformed control, wrong account, redirect, incomplete pagination, or malformed response fails closed. Live wall time and repository identity are sampled after attendance and Keychain reads, then revalidated immediately before both the duplicate-preflight GET and the single POST. Stale, invalid, backwards, dirty, or changed state burns the one-shot authorization and stops before the next network operation.

An ambiguous create is never retried. Partial Keychain storage removes only items that still carry the current invocation's nonsecret ownership tag and attempts one compensating delete only when a strict response proved the exact name and a safe token ID. A pre-existing, replaced, or process-death partial item requires manual review; rollback never guesses ownership.

The earlier unattended-access governance keeps its original protected hashes. This batch records explicit successor hashes for the shared secret scanner and package release wiring, allowing the predecessor gate to verify both historical provenance and the authorized current extensions without rewriting its baseline.

## Safe Sequence

```bash
npm run infrastructure:cloudflare-founder-attended:presence
npm run infrastructure:cloudflare-founder-attended:provision-attended
npm run infrastructure:cloudflare-founder-attended:cleanup-temp
npm run infrastructure:cloudflare-founder-attended:presence
```

Immediately after `cleanup-temp`, the Founder must revoke the temporary Cloudflare API token in Cloudflare. A consumed control receipt remains intact. A manual-review result must not be retried.

Before the generated smoke pair can be declared ready for unattended use, the Founder must separately authorize and complete the real-Keychain interoperability check through the audited reader. This source batch does not perform that check.

## Release Boundary

This batch may verify, commit, and fast-forward push source under the standing automatic-push policy. It does not authorize Cloudflare access, real Keychain value access, credential creation, Access policy changes, deployment, production mutation, prospective collection, cohort activation, or recommendation influence.
