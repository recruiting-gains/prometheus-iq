# Cloudflare Unattended Keychain Retrieval Interoperability Governance v1

Owner: Prometheus Overwatch

Batch: `BATCH-20260715-008`

Prometheus Infrastructure owns commit `8fa8d6943431c68b9f5a556499243e9838378440`. Overwatch independently verified the fixed four-item classifier, shared launcher retrieval path, item-level remediation, and rollback design without modifying Infrastructure implementation.

The live noninteractive classification found all four governed items `PRESENT`, the login Keychain `UNLOCKED`, and the launcher execution identity `MATCHED`. Every item returned `NOT_RETRIEVABLE INTERACTION_REQUIRED`. No credential value, length, prefix, digest, response body, Keychain path, or Account ID was reported or persisted.

Before classification, Overwatch terminated the blocked parent from the earlier deployment-query attempt and its orphaned `/usr/bin/security` reader. The prior call path was still blocked at its first Keychain read, before Wrangler could start. No stale reader remained during classification.

Remediation is Founder-attended and item-scoped. It requires a fresh classification no older than 30 minutes, a native controlling TTY, and the exact confirmation phrase. It may add `/usr/bin/security` only to the decrypt ACL of the four governed items. It may not change a credential value, service identity, account identity, whole-Keychain policy, or any unrelated item. A partial failure rolls back newly added trust, and explicit rollback removes only trust added by this repair.

The unattended deployment control remains absent and therefore `OFF`; no nonce is consumed. This batch authorizes no deployment, Cloudflare request, Access-policy change, production mutation, cohort activation, prospective collection, or recommendation influence.

The Founder-attended completion sequence is:

```sh
cd /Users/cruzgarza/Documents/Prometheus
node scripts/run-cloudflare-unattended-keychain-interoperability.mjs classify
node scripts/run-cloudflare-unattended-keychain-interoperability.mjs remediate
```

The classifier is expected to exit nonzero while reporting the governed remediable state. The remediation command independently rejects expired, ambiguous, non-remediable, or multiple classification evidence and cannot be forced.

Rollback, if needed, is:

```sh
node scripts/run-cloudflare-unattended-keychain-interoperability.mjs rollback
```
