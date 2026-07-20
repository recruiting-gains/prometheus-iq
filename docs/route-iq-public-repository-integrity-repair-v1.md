# Route IQ Public Repository-Integrity Repair v1

Owner: Prometheus Infrastructure
Batch: BATCH-20260719-008
Status: clean-runner public-asset generation repair implemented locally; not pushed or deployed

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

## Dashboard verification successor

Dashboard commit `bb1509d42cd03c19b9db0f9011579b6a041ffd9c`, tree
`2bd8186faafd7c922c17da9401c6dddbc64163bb`, is a linear successor of the Overwatch commit
`03ed86e25bda0a67e55757969966f4bc61c4b63e`. Its author and committer are both
`Prometheus Dashboard <dashboard@prometheus.local>`, and its exact scope is:

- `scripts/verify-dashboard-runtime-workflows.mjs`
- `tests/dashboard-route-iq-product-focus.test.mjs`

The Dashboard successor replaces wall-clock-dependent Eventbrite verification with an explicit,
advancing, noncanonical test clock and strengthens the test-only Add Place, access, map, and link
assertions. Independent Infrastructure validation passed eight focused tests and all 184 browser
workflow checks. The commit changes no product runtime, Website, CRM, Worker, configuration, or
generated deployment asset.

Infrastructure admits only that immutable Dashboard commit: exact hash, tree, parent, author,
committer, subject, and two-file scope. The admission does not authorize any other Dashboard commit
or any general Dashboard-owned path pattern. Its Infrastructure successor is separately constrained
to parent `bb1509d42cd03c19b9db0f9011579b6a041ffd9c`, the Infrastructure owner identity, subject
`infrastructure: admit Dashboard verification successor`, and the four Infrastructure provenance
files.

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
- The Dashboard verification exception is an immutable commit admission in dependency order. An
  altered Dashboard tree, identity, parent, subject, or file list fails closed, as does any additional
  Dashboard successor. The Infrastructure provenance successor is equally constrained and does not
  relax the default Overwatch-only descendant rule.
- Public-intake smoke commits `c05c92930f33ca2f50362c1ad3c35efc95a645f0` and
  `6476c381c8e9512eaea4a90e0f6019138cfe1766` are admitted only as an ordered immutable pair. Each
  exact parent, tree, Infrastructure author and committer identity, subject, and three-file scope is
  pinned. Their provenance successor is limited to parent `6476c381c8e9512eaea4a90e0f6019138cfe1766`,
  one exact subject, and the four Infrastructure provenance files. Mixed ownership, merges, scope
  drift, extra files, and any later non-Overwatch successor remain rejected.

## Clean-runner deployment failure and repair

Founder-authorized workflow run `29723618108` used commit
`1e4e9be843fe418ae8920ccb109b4259fda5455c`, tree
`e0d86821386d2f3d348eb88ae25f85f367878280`. Its first no-secret verification
step failed with a missing `dist-public` directory. The deployment job was skipped, no deployment
artifact was produced, and Cloudflare remained unchanged. That run is consumed and is not retried
by this repair.

`dist-public` is deterministic generated output and is intentionally absent from a clean Git
checkout. The public deployment workflow now runs the locked build exactly once in each job,
immediately after `npm ci` and before the first no-secret release verifier. Focused tests reproduce
an artifact-free clone, generate the directory, compare every byte with the tracked public
deployment tree, and require the unchanged deployment-asset SHA-256. The repair does not modify the
tracked deployment assets or forward-rollback artifact.

The owner-boundary admission for this repair is constrained to parent
`1e4e9be843fe418ae8920ccb109b4259fda5455c`, the Infrastructure author and committer identity,
subject `infrastructure: generate public assets before verification`, and the exact documented
Infrastructure file scope. Any mixed ownership, merge, extra file, or subsequent non-Overwatch
successor remains rejected.

The repaired path-independent rollback artifact is:

`3c1991905657516653ee74ef0ac59f711b21f95df06bf490be5f370479ba7ff7`

## Keychain verifier CI portability provenance

Founder-authorized deployment workflow run `29758138044` failed closed in the no-secret test job
before Cloudflare access. The unrelated Keychain interoperability owner verifier invoked macOS
`/usr/bin/swiftc` unconditionally on the Linux runner. Infrastructure commit
`af2d85d80a1abf332e202a1d24ca0c290d9d6a6b` preserves the macOS typecheck and reports the check as
not applicable on non-macOS hosts; its regression test exercises that Linux path. Overwatch commit
`06a6464035d3b8d46f308c77955a80a62ddfa957` independently pins the two owner-authored successor
files.

This integrity gate admits only that exact Infrastructure commit, followed by the exact Overwatch
mapping and this four-file Infrastructure provenance admission. It does not permit generic
Infrastructure successors, mixed ownership, altered file scope, merges, or deployment retries.
Because the immutable Overwatch mapping predates the `overwatch:` subject convention, its full
commit, tree, parent, author, committer, literal subject, and file scope are pinned explicitly. No
general exception to the Overwatch subject convention is introduced.

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

All three failed runs, the readiness successor, and the Dashboard test-only successor remain
immutable evidence. The safe CI and deployment workflow runs are consumed and are not retried by
this owner task. This repair does not
authorize a workflow dispatch, push, deployment, CRM submission, secret access, or production
change.
