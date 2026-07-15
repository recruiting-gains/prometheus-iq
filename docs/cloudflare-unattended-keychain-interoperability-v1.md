# Cloudflare Unattended Keychain Retrieval Interoperability v1

## Status and boundary

- Batch: `BATCH-20260715-008`
- Implementation owner: Prometheus Infrastructure
- Verification owner: Prometheus Overwatch
- Cloudflare contact, deployment, production mutation, Access-policy mutation, and credential mutation: prohibited
- Unattended deployment control: `OFF` and unconsumed
- Prospective collection: `OFF`
- Active cohorts: `0`
- Recommendation influence: `OFF`

This repair classifies and, only with the Founder physically attending a native controlling terminal, repairs the macOS Keychain access path used by the audited unattended launcher. It does not change any credential value or Keychain service/account identity.

## Shared execution path

The launcher and classifier both import `scripts/lib/cloudflare-unattended-keychain.mjs`. That module fixes the executable to `/usr/bin/security`, fixes all four service/account pairs from the existing registry, constructs a bounded environment, and permits no caller-supplied item or executable.

The classifier first verifies the concrete execution identity and Keychain lock state. It then performs metadata-only exact, service-only, and account-only checks as needed. A retrieval probe captures at most 64 KiB into bounded process memory, reports only a fixed state, fills the captured buffers with zeroes, and discards them immediately. It never reports a value, prefix, length, digest, Account ID, stderr body, or Keychain path.

Safe classifications distinguish:

- item absence,
- locked Keychain,
- wrong service identity,
- wrong account identity,
- ACL denial,
- execution-identity mismatch,
- interaction required, and
- unknown fail-closed errors.

## Real classification

From a clean, synchronized repository:

```bash
node scripts/run-cloudflare-unattended-keychain-interoperability.mjs classify
```

The command reports only the four fixed aliases, `PRESENT`/`ABSENT`/`UNKNOWN`, `RETRIEVABLE`/`NOT_RETRIEVABLE`, fixed reason codes, and `PASS`/`FAIL`. It creates one immutable, owner-only classification attempt bound to the current commit and tree for at most 30 minutes.

## Founder-attended remediation

Remediation is available only when one fresh classification proves all four exact items are present, the Keychain is unlocked, the execution identity matches, and every failed retrieval is attributable to ACL denial or required interaction.

```bash
node scripts/run-cloudflare-unattended-keychain-interoperability.mjs remediate
```

Exact phrase:

```text
REPAIR ONLY THE FOUR PROMETHEUS UNATTENDED KEYCHAIN ACCESS PERMISSIONS
```

The command uses the existing native `/dev/tty` confirmation boundary. It consumes the fresh classification before any ACL change. The Swift helper has an internal four-item allowlist and may add only `/usr/bin/security` to the one decrypt ACL for an exact governed item. It never requests password data, changes a value, renames an item, accepts a path, or changes a whole Keychain policy.

After all necessary additions, the same noninteractive classifier must report all four items `RETRIEVABLE`. A partial or failed remediation attempts to remove every trust entry added by that attempt in reverse order. All evidence is append-only, owner-only, and restricted to fixed nonsecret phases.

## Exact rollback

Rollback requires a separate Founder-attended command and phrase:

```bash
node scripts/run-cloudflare-unattended-keychain-interoperability.mjs rollback
```

```text
ROLL BACK ONLY THE PROMETHEUS UNATTENDED KEYCHAIN ACCESS PERMISSIONS ADDED BY THIS REPAIR
```

Rollback accepts exactly one unrolled successful remediation at the same clean commit and tree. It removes only `/usr/bin/security` trust entries recorded as newly added by that repair. It does not remove pre-existing trust and cannot read, replace, delete, or recreate a credential value.

## Evidence safety

Evidence lives outside Git under:

```text
$HOME/.prometheus/infrastructure/cloudflare-unattended-keychain-interoperability-v1
```

Directories are current-user-owned `0700`; files are current-user-owned, single-link, regular `0600` files created exclusively with no symlinks. Classification consumption, remediation phases, and rollback consumption are append-only. Expired, replayed, ambiguous, permission-drifted, symlinked, malformed, cross-attempt, dirty-tree, or commit/tree-mismatched evidence fails closed.

## Local verification

These commands use source inspection, injected process results, temporary local evidence, and Swift type checking only:

```bash
node scripts/verify-cloudflare-unattended-keychain-interoperability.mjs
node --test tests/cloudflare-unattended-keychain-interoperability.test.mjs
npm run infrastructure:cloudflare-unattended-runtime-guard:check
npm run infrastructure:cloudflare-unattended-access:check
npm run security:check
npm run security:aegis:verify
```

No verification command contacts Cloudflare or reads a real credential value.
