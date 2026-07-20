# Route IQ Public Repository-Integrity Repair v1

Owner: Prometheus Infrastructure
Batch: BATCH-20260719-008
Status: historical repair range pushed; CI portability successor implemented locally, not pushed or deployed

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

## Safe CI portability failure

The read-only workflow run `29717192952` checked out commit
`8d312bf747a289c675eb37adf582b43c860c635e` and tree
`36f163193fdb91cf241ddb0ff03bce200c7506c6` on Ubuntu 24.04 with Git 2.54.0,
Node 24.18.0, npm 11.16.0, an exact HTTPS origin, no tags, and seven refs: local `main`,
`origin/main`, and five Dependabot remote branches. Its standalone strict repository diagnostic
passed before dependency installation. The later owner verifier printed only `FAIL` and exited 1;
the workflow had no deployment capability, environment, secrets, Cloudflare access, or production
write path.

An isolated Ubuntu reproduction of that exact checkout shape proved the owner verifier failed in
rollback source-map canonicalization. Wrangler emitted 53 valid relative `sources[]` entries and a
valid source-map `sourceRoot`. The canonicalizer resolved those entries from the verifier process
directory instead of from `sourceRoot`, so all 53 resolved outside the permitted workspace and
`node_modules` boundaries and raised `public_forward_rollback_source_map_outside_boundary`.

The same defect passed on macOS only because its deeper `/private/var/...` temporary path made the
incorrect process-directory resolution contain coincidental boundary markers. The seven-ref shape,
HTTPS origin, missing tags, full-history checkout, Git integrity, and Node version were independently
reproduced on macOS and were not causal.

## Repair

- The generated Worker canonicalizes source-section paths relative to the extracted workspace and
  resolves filesystem aliases before hashing.
- Generated source maps now resolve every relative source from the already validated `sourceRoot`,
  require the source to exist, resolve filesystem aliases, and admit only files whose real paths are
  inside the extracted workspace or the governed repository `node_modules` tree. Missing sources,
  altered roots, symlink escapes, and out-of-bound paths fail closed.
- Owner-verifier failures now emit one fixed, bounded, nonsecret classification. A valid source that
  escapes the two governed boundaries reports
  `OWNER_VERIFIER_ROLLBACK_SOURCE_MAP_OUTSIDE_BOUNDARY`; assertion, rollback, repository-integrity,
  and internal failures have separate closed classifications. Raw exception text is never emitted,
  and bare `FAIL` is no longer an output path.
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
- Owner verification now terminates the Infrastructure implementation boundary at
  `a2779239fc8f2d79d4b8781966d32cc23d4acbbd`, with predecessor
  `a2bcfedcd996e4d6d22adc26d20bd77a39e763e7`. It pins each commit's parent, tree, author and
  committer identities, subject, file scope, and contract blob instead of treating every later
  commit as Infrastructure work.
- The legitimate Overwatch readiness successor
  `96af76e8094beafc2de455ebb5d80755c0160a2e` is independently pinned. Later linear,
  Overwatch-authored governance and verification successors are permitted only in Overwatch-owned
  paths; merges, mixed identities, Infrastructure-path drift, and out-of-scope owner files fail
  closed.
- The CI portability successor is constrained to parent
  `8d312bf747a289c675eb37adf582b43c860c635e`, Infrastructure author and committer identity, one exact
  subject, and the five documented Infrastructure files. The five pushed historical repair commits
  remain unchanged.

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

Both failed runs and the readiness successor remain immutable evidence. The safe CI run is consumed
and is not retried by this owner task. This repair does not authorize a workflow dispatch, push,
deployment, CRM submission, secret access, or production change.
