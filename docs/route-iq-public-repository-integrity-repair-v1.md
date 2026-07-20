# Route IQ Public Repository-Integrity Repair v1

Owner: Prometheus Infrastructure
Batch: BATCH-20260719-008
Status: implemented locally; not pushed or deployed

## Failed run

GitHub Actions run `29714512987` checked out full `main` history at commit
`d5174c50ee7b02f930b5fa1f50723ce9db3e447d` and tree
`f86156dc10fb90cedc00274d3654e89edfff562a` with pinned checkout action
`34e114876b0b11c390a56381ad16ebd13914f8d5`, `fetch-depth: 0`, and Git 2.54.0.
The verification command returned `REPOSITORY_INTEGRITY_FAILED`; its deployment job was skipped and
the protected environment was never accessed.

## Reproduced cause

The failure occurred before `git fsck`. The suppressed exception classified as
`ROLLBACK_HASH_MISMATCH`; there was no suppressed fsck diagnostic because fsck was never reached.

The rollback dry-run Worker contained esbuild section comments derived from checkout paths. The same
source produced different generated-Worker and artifact hashes in the laptop checkout and a clean
full-history checkout. The old top-level catch converted that rollback exception into the generic
repository-integrity result, hiding the actual failed stage.

No reachable corruption or invalid fetched ref was reproduced. Local `git fsck --full --strict`
exited 0 with 4,318 benign dangling-object notices. A clean full checkout exited 0 with no output
under both the local Git runtime and a separately built Git 2.54.0 binary. These facts do not prove
what every hosted runner would report; the repaired command therefore preserves strict, fail-closed
fsck and emits bounded classifications if a future runner detects a real failure.

## Repair

- The generated Worker canonicalizes source-section paths relative to the extracted workspace and
  resolves filesystem aliases before hashing.
- Rollback failures report `ROLLBACK_INVALID`; unexpected preflight exceptions report
  `PREFLIGHT_FAILED`; only failed repository checks report `REPOSITORY_INTEGRITY_FAILED`.
- Strict fsck now runs before rollback generation and any credential access. It uses
  `--full --strict --no-dangling --no-progress`, a 128 KiB capture ceiling, disables system and
  global Git configuration, and rejects shallow, partial, promisor, or unsupported-object-format
  repositories. Nonempty output is fail-closed even when Git reports exit zero.
- Failure output is never echoed. Diagnostics contain fixed classifications, exit/signal state, and
  bounded byte counts only.
- A separate manual, read-only CI workflow can reproduce repository-integrity verification without
  a protected environment, secrets, Cloudflare access, deployment, or CRM activity.
- The Infrastructure successor fixes the runtime order to checkout, pinned Node 24 setup, repository
  diagnostic, locked dependency installation, then rollback verification. No repository-owned Node
  script may execute with the hosted runner's ambient Node runtime.

The repaired path-independent rollback artifact is:

`3c1991905657516653ee74ef0ac59f711b21f95df06bf490be5f370479ba7ff7`

## Operator use

Local non-deployment diagnostic:

```sh
node scripts/run-public-worker-repository-integrity-diagnostic.mjs
```

Owner contract verification:

```sh
node scripts/verify-route-iq-public-repository-integrity-repair.mjs
node --test tests/public-repository-integrity-repair.test.mjs
```

The previous failed run and readiness successor remain immutable evidence. This repair does not
authorize a workflow dispatch, push, deployment, CRM submission, secret access, or production change.
