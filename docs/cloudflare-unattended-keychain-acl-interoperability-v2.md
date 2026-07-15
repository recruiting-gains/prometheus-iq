# Cloudflare Unattended Keychain ACL Interoperability v2

## Boundary

- Batch: `BATCH-20260715-009`
- Implementation owner: Prometheus Infrastructure
- Verification owner: Prometheus Overwatch
- Cloudflare contact: prohibited
- Governed credential-value access during engineering: prohibited
- Governed ACL mutation during engineering: prohibited
- Deployment and production mutation: prohibited
- Unattended deployment control: `OFF` and unconsumed
- Prospective collection: `OFF`
- Active cohorts: `0`
- Recommendation influence: `OFF`

This is a successor to the failed BATCH-20260715-008 attended attempt. Every file under `$HOME/.prometheus/infrastructure/cloudflare-unattended-keychain-interoperability-v1` remains immutable audit evidence. The v2 workflow never reads, reuses, renames, deletes, or writes that namespace.

## Root cause

BATCH-20260715-008 changed only application trust on the ACL selected for `Decrypt`. The four exact items then remained `INTERACTION_REQUIRED` for noninteractive `/usr/bin/security find-generic-password -w` reads, and the v1 workflow reversed every change.

The authorization mismatch is two independent gates:

1. The installed macOS SDK declares `kSecACLAuthorizationDecrypt` and the separate `kSecACLAuthorizationPartitionID` in `Security.framework/Headers/SecAccess.h`.
2. Apple's `security(1)` source states that a generic-password partition list is an additional ACL parameter that limits access by application code signature.
3. Apple OSS `Security/securityd/src/clientid.cpp` maps code identifier `com.apple.security`, used by `/usr/bin/security`, to `apple-tool:` and maps other Apple-signed code to `apple:`. `Security/securityd/src/acls.cpp` checks partition authorization by exact `CFArrayContainsValue` membership. The selector identity for `/usr/bin/security` is exactly `apple-tool:`; `apple:` is neither a substitute nor a required companion selector.
4. Apple's SecurityTool implementation routes `find-generic-password -w` through `SecKeychainItemCopyContent`.
5. A disposable native E2E fixture snapshots the user-domain Keychain search list and default Keychain through `SecKeychainCopyDomainSearchList` and `SecKeychainCopyDomainDefault`, normalizing each reference with bounded `SecKeychainGetPath` buffers. It then creates and unlocks a UUID-scoped temporary legacy Keychain through `SecKeychainCreate`, without modifying the user search list or default Keychain. After deletion and bounded filesystem absence verification, it copies and compares the same ordered native paths before passing. It does not call `SecKeychainSetUserInteractionAllowed`: suppression blocked both legacy creation and access-write operations instead of returning a fixed no-interaction status. The fixture instead avoids every GUI-prone negative read, trusts only the exact synthetic fixture and compiled native-test helper identities needed to administer the disposable item, and enforces hard child-process deadlines. It creates a UUID-scoped generic-password item through `SecItemAdd`, supplying its initial `SecAccess` through `kSecAttrAccess` at creation time, targeted to that Keychain, and retains its returned reference for the baseline ACL snapshot. The initial access never trusts `/usr/bin/security`. The synthetic ACL structurally proves that `/usr/bin/security` has neither the exact Decrypt grant nor `apple-tool:` before grant and after revoke; the immutable real-item classification remains the only `INTERACTION_REQUIRED` negative evidence. The fixture never launches an untrusted negative `security` read that could wait for UI. The production helper is compiled only in native-test mode with the exact temporary-Keychain path; normal production lookup remains unchanged. It performs one real positive `security(1)` read only after exact Decrypt plus `apple-tool:` verification, then restores the exact initial ACL snapshot. Helper and positive-read children have a fixed five-second deadline and are terminated on expiry. Fixed phase markers are atomically written at each boundary; a timeout reports the last completed marker and always fails. Before `SecKeychainDelete`, the fixture releases all item references; it then checks the Keychain path and `-db` sidecar immediately and for a bounded one-second wait. The verifier separately checks post-process absence and preserves the primary fixture failure over any cleanup observation. Synthetic failures classify to fixed nonsecret states; raw OSStatus and diagnostic data never leave the fixture.

The candidate minimum remains an exact trusted-application ACL containing only `Decrypt` for `/usr/bin/security`, together with the existing item's partition list extended only by `apple-tool:`. The repair does not add `apple:`, `teamid:`, `cdhash:`, `unsigned:`, or an arbitrary executable. It does not place `/usr/bin/security` onto Apple's broader default limited-rights ACL.

Two test-only matrices gate any change to that candidate. The selector matrix compares exact `apple-tool:`, exact `apple:`, and `apple-tool:` plus `apple:` while holding the application ACL to `/usr/bin/security` and `Decrypt`; `apple-tool:` must pass on its own, while either an `apple:`-only success or a combination-only success is rejected as suspicious. If that exact selector remains blocked, the authorization matrix holds `/usr/bin/security` and `apple-tool:` fixed while comparing `Decrypt`, `ExportClear`, and their exact pair. Every case uses a separate isolated Keychain and a five-second deadline. Timeout is always failure. A proposed minimum must agree across forward and reverse matrix orderings and then pass at least 20 independent full grant/read/revoke/restoration lifecycles before production authorization can change. Until those gates are reproducible, the helper remains unchanged and the batch remains `FOUNDER_REVIEW_REQUIRED`.

Grounding inspected locally:

- Installed SDK: `Security.framework/Headers/SecAccess.h`
- Apple OSS SecurityTool: `SecurityTool/macOS/security.1`
- Apple OSS SecurityTool: `SecurityTool/macOS/keychain_find.c`
- Apple OSS securityd: `Security/securityd/src/clientid.cpp`
- Apple OSS securityd: `Security/securityd/src/acls.cpp`
- Apple OSS keychain implementation: `OSX/include/security_keychain/Access.cpp`

## Fail-closed owner repair

The Swift helper has an internal allowlist for exactly these aliases:

- `DEPLOYMENT_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `SMOKE_CLIENT_ID`
- `SMOKE_CLIENT_SECRET`

It fixes the trusted executable to `/usr/bin/security`. It accepts exactly one well-formed partition ACL and rejects nil application lists on secret ACLs, duplicate trusted applications, duplicate matching ACLs, duplicate partitions, malformed partition property lists, broader `/usr/bin/security` rights, and marker collisions.

For each item, the helper computes the missing authorization components in memory and commits them in one `SecKeychainItemSetAccess` operation. An identical pre-existing exact component is preserved. If post-write verification fails, the helper restores that item's prior state before returning. Failure to prove restoration is a distinct `ROLLBACK_FAILED` condition. The orchestration layer then reverses every previously changed item in reverse order.

PASS requires all four exact items to be `RETRIEVABLE` through the existing noninteractive classifier after the ACL changes. No partial result can pass.

## Provenance repair

Commit `348978de14a09651565c84c0b445b8371c496131` carries the local provenance-metadata gap: its author and committer are `Prometheus Overwatch Rollback Verification`, despite the nine-file implementation being Infrastructure work. The successor stores SHA-256 pins for the exact original bytes, verifies the committed file set and Git metadata, and is authored and committed by `Prometheus Infrastructure <infrastructure@prometheus.local>`. This documents metadata only; it does not rewrite, amend, or reinterpret the original commit.

## Evidence

New evidence uses only:

```text
$HOME/.prometheus/infrastructure/cloudflare-unattended-keychain-acl-interoperability-v2
```

Every classification and remediation receives a UUID attempt directory. Directories are current-user-owned `0700`; files are current-user-owned, single-link, regular `0600` files created exclusively with no symlink following. A fresh classification is bound to clean repository commit and tree state, expires after at most 30 minutes, and is consumed before any ACL change. Cross-attempt substitution, replay, ambiguous concurrent classifications, malformed evidence, wrong ownership, wrong modes, and symlinks fail closed.

Evidence contains only fixed aliases, component states, fixed reason/phase labels, timestamps, and repository binding. It contains no Keychain values, account IDs, client IDs, lengths, prefixes, hashes of credentials, Keychain paths, or helper diagnostics.

## Founder-attended boundary

Only after independent Overwatch acceptance, create one fresh classification:

```bash
node scripts/run-cloudflare-unattended-keychain-acl-interoperability-v2.mjs classify
```

If and only if it records one eligible four-item failure, the separately authorized attended remediation command is:

```bash
node scripts/run-cloudflare-unattended-keychain-acl-interoperability-v2.mjs remediate
```

Exact phrase:

```text
REPAIR ONLY THE FOUR PROMETHEUS UNATTENDED KEYCHAIN ACL AUTHORIZATION SETS
```

The phrase is displayed and read only through the existing native `/dev/tty` boundary. Redirected input/output, wrong or oversized confirmation, missing controlling TTY, dirty repository state, stale evidence, or identity drift stops before ACL access.

An evidence-bound successful remediation can be reversed once with:

```bash
node scripts/run-cloudflare-unattended-keychain-acl-interoperability-v2.mjs rollback
```

Exact phrase:

```text
ROLL BACK ONLY THE PROMETHEUS UNATTENDED KEYCHAIN AUTHORIZATIONS ADDED BY THE V2 REPAIR
```

Rollback removes only the exact dedicated ACL and/or `apple-tool:` selector recorded as added by that v2 attempt. It never removes pre-existing authorization or changes a credential value.

## Local verification

```bash
node scripts/verify-cloudflare-unattended-keychain-acl-interoperability-v2.mjs
node --test tests/cloudflare-unattended-keychain-acl-interoperability-v2.test.mjs
node scripts/verify-cloudflare-unattended-keychain-acl-v2-native.mjs
node scripts/verify-cloudflare-unattended-keychain-acl-v2-native.mjs --matrix
node scripts/verify-cloudflare-unattended-keychain-acl-v2-native.mjs --matrix-reverse
node scripts/verify-cloudflare-unattended-keychain-acl-v2-native.mjs --authorization-matrix
node scripts/verify-cloudflare-unattended-keychain-acl-v2-native.mjs --authorization-matrix-reverse
node scripts/verify-cloudflare-unattended-keychain-acl-interoperability-v2-provenance.mjs
node --test tests/cloudflare-unattended-keychain-acl-interoperability-v2-provenance.test.mjs
```

The native command uses one UUID-scoped synthetic Keychain item. It never names or reads any governed item, zeros every captured synthetic buffer, and proves cleanup before PASS.
