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

## Safe no-secret clean-runner asset ordering

Safe no-secret workflow run `29776569151` checked commit
`5d5ffe858d7e132778c96746eabd4a99afe9d1f4`, tree
`e0164513b6a807796558c2d7bf6c059184839659`, on Ubuntu 24.04 with Node 24.18.0.
Dependency installation passed, but `npm test` reached the exact deployment-asset verifier before the
ignored `dist-public` directory had been generated. The run failed closed; it had no protected
environment, secret, Cloudflare, deployment, CRM-write, or production-mutation capability.

Infrastructure now places the single top-level deterministic `npm run build` step immediately after
`npm ci` and before `npm test`. The later duplicate workflow build step was removed. Static and
adversarial tests require that exact ordering, exactly one top-level build command, the unchanged
full-suite command, and rejection of missing or reordered generation. Asset parity remains strict;
there is no retry, `continue-on-error`, `|| true`, or weakened release check.

## Cloudflare deployment state-read repair provenance

Founder-authorized run `29780926642` completed the full no-secret verification job and the fixed
pre-deployment GET/HEAD smoke. Its guarded deployment step then stopped after 15.016 seconds with
only `DEPLOY_FAILED`. The public version remained unchanged and no version was created, so no
rollback was required. Local synthetic reproduction proved that an error while consuming a
Cloudflare response body escaped the transport classifier and reached the generic command fallback.

Infrastructure commit `e896cabe19fc696834659ed1cbe05f027c434553` closes that gap with fixed,
nonsecret endpoint phases and distinct network, HTTP, timeout, body-read, and response-validation
classifications. It preserves the response-size limit, zero retries, and one deployment attempt.
Infrastructure commit `f09b8c1ee6e4c0be14c41f672601e2e5854014eb` then replaces the confirmed
insufficient 15-second production deadline with a fixed 30-second deadline. Six lifecycle snapshots
perform at most 12 serialized state reads, so the worst-case read budget is six minutes inside the
30-minute deployment job. The only injectable shorter deadline is exposed through a test-only helper
capped at one second; the production entry point has no timeout override.

The owner boundary admits only those two commits in that order, with exact commit, tree, parent,
Infrastructure identity, subject, and four-file scope, followed by the exact four-file Infrastructure
provenance admission. Reordered commits, mixed ownership, merges, widened scope, extra Infrastructure
successors, retries, and deployment capability remain rejected. This repair did not contact
Cloudflare and did not modify Website, CRM, deployment assets, or rollback artifacts.

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

The subsequent historical-fixture repair is similarly exact. Infrastructure commits
`a69dd6ac8785f0906d1ad91e9ca156f5250dc22e` and
`0165ffc56a18408be5c2e970223944fa1dd02593` distinguish the immutable July 15 fixture from its
current CI-portability successor and report the resulting six ownership tests. Overwatch commit
`41d9f1fa9273482261500708d7299a1997f6ec69` maps those owner changes. This verifier accepts only
that three-commit sequence followed by the exact four-file Infrastructure provenance admission.

## Dashboard runtime harness adoption and full no-secret CI

GitHub Actions run `29764135072` failed before deployment while executing
`dashboard:runtime-workflows:check`. The first Dashboard owner repair replaced the macOS-only
default Chrome path, surfaced process-launch failure directly, used Chrome's operating-system
assigned DevTools port, bounded readiness work, and registered cleanup before startup could fail.
The second Dashboard owner repair preserved that cross-platform foundation while allowing one
bounded 30-second readiness transaction under runner CPU contention and closing each CDP page
target between scenarios. It also preserves deterministic interrupt cleanup. These repairs are
the ordered owner commits:

- `38339cdf24f2ccdf54f2eb204278eb80d9ad1972`
- `577b9217185be2324824c5c4eeeaf6cd89300477`

Infrastructure adopts only that exact two-commit sequence, Dashboard identity, file scope, final
file hashes, and test evidence. The admission does not generally authorize later Dashboard
successors and does not classify either Dashboard file as Infrastructure implementation.

The existing `Verify Prometheus Public Repository Integrity` workflow now runs the complete
applicable predeployment suite on Ubuntu. It remains manual `workflow_dispatch` only, Founder-only,
main-only, first-attempt-only, read-only, and concurrency protected. It has no protected
environment, secret reference, Cloudflare request, deployment command, CRM submission, notification,
or production mutation path. In addition to `npm test`, it invokes explicit lint, typecheck, build,
security, Aegis, rollback, deployment-asset, owner-provenance, release-readiness, and artifact-contract
gates before requiring a clean repository. Static adversarial tests fail closed if a trigger,
permission, environment, secret, deploy command, blanket success override, required command, actor
check, or one-attempt guard drifts.

## Wrangler deployment diagnostic repair provenance

BATCH-20260720-007 run `29786701514` passed repository verification, pre-deployment smoke, and
Wrangler dry-run before invoking the bounded Wrangler deploy child. The child exited nonzero, but
the predecessor wrapper discarded its output and reported only `DEPLOY_FAILED`. No matching
successful Cloudflare mutation audit entry exists for that run, and the public and private Worker
versions remained unchanged. The failure dimension therefore remains
`UNCLASSIFIABLE_FROM_PRE_REPAIR_WRAPPER`; this repair does not assign a reason retroactively.

The successful asset-upload-session and three successful Upload Assets entries observed at 16:43
CDT belong to BATCH-20260720-006 run `29780926642`. That prior evidence remains separate and is not
attributed to BATCH-20260720-007.

Infrastructure commit `ba4d25df97e12852982e1bbdc2b1e89ef5265da1` adds fixed, nonsecret Wrangler
4.110.0 deployment diagnostics for spawn failure, timeout, bounded-output overflow, signal
termination, asset-session rejection, asset upload failure, missing asset completion, Worker
version/upload rejection, migration/binding/config rejection, authorization denial, network
uncertainty, and unknown nonzero exit. Ambiguous output remains `UNKNOWN_NONZERO_EXIT`. The wrapper
still runs one child per mode, never retries, kills on timeout or overflow, zeroizes every captured
buffer, and emits only the fixed phase and reason fields. It never emits or materializes raw child
output as text.

The owner boundary pins that exact repair commit, tree, parent, Infrastructure identity, subject,
and four-file scope, followed by this exact four-file Infrastructure provenance admission. Synthetic
repositories reject reordered lineage, mixed ownership, widened admission scope, merges, and later
unapproved Infrastructure successors. This repair did not contact Cloudflare and did not modify the
website, CRM, deployment assets, rollback artifacts, deployment workflow, or Overwatch files.

## Public Worker module-start repair provenance

BATCH-20260720-008 run `29795006056`, verification job `88524441880`, and deployment job
`88525105691` reached Cloudflare with the pre-repair public bundle. Cloudflare returned code `10021`,
which the predecessor classifier incorrectly labeled `MIGRATION_BINDING_CONFIG_REJECTED`. The public
and private Worker versions and their 100 percent traffic allocations remained unchanged, the public
CRM Durable Object namespace was not created, and no production mutation occurred.

Local Workerd reproduction established the ordered root causes without assigning either from the
generic provider code alone. First, module evaluation failed as
`WORKER_RUNTIME_FILESYSTEM_IMPORT_AT_MODULE_STARTUP` because the Intelligence retention module used
`fileURLToPath(import.meta.url)` at module startup. After the Intelligence-owned correction, Workerd
advanced and rejected the broad public export surface as `INVALID_PUBLIC_EXPORT_SURFACE`, including
the non-handler `CALLBACK_PATH` export. Infrastructure then introduced a narrow public entry adapter
that exports only the default fetch handler and `RouteIqRequestCrmCoordinator`, plus a local-only,
no-secret Workerd startup preflight requiring `HEAD /` to return `200` before any Cloudflare request.

The exact admitted owner chain is:

- Intelligence commit `f0593640bae9cb9517d954415ca4980226a51073`
- Infrastructure commit `94061fea1c238ca854bde9d17a860e1375af9c52`
- Infrastructure commit `ce5f66f777fcfd6f59fe2b33eebb05bc836742dc`

Each commit is pinned by full commit, tree, parent, author and committer identity, literal subject,
and exact changed paths. This four-file Infrastructure admission is constrained to parent
`ce5f66f777fcfd6f59fe2b33eebb05bc836742dc`; it does not authorize generic Intelligence or
Infrastructure successors. The original Website deployment asset remains unchanged. The regenerated
forward rollback artifact is
`b0eae685ddefb99680bd60f074b58ae7514c467f6ce95d069e35dc450db2d76a` and preserves the CRM class,
binding, SQLite migration history, namespace, and records while retaining the narrow adapter.

## Public config entry consumer repair provenance

Infrastructure commit `8aac9d66fa5b5d6ff191354e68a364aa142ede95` updates the edge-boundary
consumer from historical public configuration SHA-256
`a93267b924c9cca22c891df5d037483e2ecf453de19d115730756444d354f23f` to current SHA-256
`5b8e16a1e49172f20ef617d09e6e655b5ee453600b486fe5d216ebe5453b56f0`. The
historical semantic projection remains pinned, proving that `main` is the sole admitted top-level
successor from `workers/prometheus-iq-worker.js` to the narrow Infrastructure adapter. Seven focused
tests reject changes to the adapter, export surface, edge flags, Worker identity, bindings,
migrations, variables, assets, observability, private configuration, and contract scope.

The edge-boundary contract SHA-256 is
`8308c4a69d52667d192e943d9ef45d9875ca3bcb835561f3765ec7b56253e53d`. The exact
repair commit is pinned by full commit, tree, parent, Infrastructure identity, subject, and four-file
scope, followed by this exact four-file Infrastructure provenance admission. It does not authorize
later config or Infrastructure successors. `workers_dev` and preview URLs remain off; apex and www,
Access/WAF boundaries, the CRM class/binding/migration, public/private isolation, and the no-deploy
boundary remain unchanged.

## CRM public Worker adapter repair provenance

CRM commit `ab480ba101bc314946879af5cdb7997bd8085b4d`, tree
`97a4ef6a0925db41fc03b9b9d092aa32aa2051e3`, follows the existing Overwatch closure at
`d562f62acf749685e099d4d7f572a4e06d69bc7b`. It adds the CRM-owned production entrypoint
contract and updates only the CRM validator and its focused test. The CRM handoff reports 40 of 40
independent validation tests passing.

The owner boundary pins that exact CRM commit, parent, owner and committer identity, literal subject,
and three-file scope. This four-file Infrastructure admission is constrained to that CRM commit and
does not authorize another CRM successor, reordered lineage, substituted ownership, or widened paths.
The original deployment asset remains
`5fd9e497e7fe814aab6194b4302528c6cff0e243e76a3dd843738f1882cd8c15`, and the forward rollback
artifact remains `b0eae685ddefb99680bd60f074b58ae7514c467f6ce95d069e35dc450db2d76a`.
No production Worker implementation, deployment, Cloudflare state, production data, public/private
isolation boundary, CRM migration, namespace, or accepted record changed under this admission.

## Public deployment Workflow v2 provenance

Infrastructure commit `30c04aca19423f448b35218491d69ecc458367c7`, tree
`a46088a5c223ba763db7a7eb99a8aec1a47b4c11`, follows deployed baseline
`07bf2eddc9707cb410ff6670efe9465ca68cd6b4`. It owns the 15 exact Workflow v2 paths that
separate qualification from deployment and produce an immutable qualified artifact without
contacting Cloudflare. The boundary pins its Infrastructure author and committer identity and the
literal subject `infrastructure: qualify immutable public releases`.

Overwatch commit `ee80a44b8a28847d4a4acfc3fae8574697661edc`, tree
`a17607eee5ff0d77f3cdfb603bc913e9f982a78a`, follows that owner commit directly. It is admitted
only as the exact 11-file governance successor with Overwatch author and committer identity and the
literal subject `overwatch: govern public deployment workflow v2`.

This Infrastructure provenance repair is admitted without a self-referential commit hash. It must
follow the exact Overwatch successor and match the Infrastructure identity, literal subject
`infrastructure: admit public deployment workflow v2 chain`, and the four owner-scoped integrity
verifier, test, documentation, and contract paths exactly. Synthetic repositories prove that the
valid ordered chain passes while a substituted owner, widened or changed path set, or incorrect
parent fails closed. The admission does not authorize another Infrastructure successor, deployment,
Cloudflare contact, product or CRM changes, or private Worker changes.

## Deployment authorization boundary repair provenance

Infrastructure commit `9c6440ba3c286b06a79435a8ec7bdf477cb4fd79`, tree
`9e09f7c9129b0eae1618cc0316da0f1a22d7c7c2`, follows the exact admitted Workflow v2 chain at
`6db68f845e91c967e34f3b825e4cbc2372cef6d8`. It is pinned as the eight-file Infrastructure-owned
repair that consumes a one-shot Founder deployment authorization only after Wrangler successfully
spawns. Invocation or spawn failure remains unconsumed; any failure after spawn remains consumed and
cannot be retried.

The repair is followed by exact Overwatch governance commits
`e2465d7a28c3222626cc8c60ed0690f8a425ee6f`, tree
`25a215fda6751214d5c8a8b2d4474531aaf6536b`, and
`4d7f5d140a7f856a18b99c1ab49a37d7555d3b5a`, tree
`a8ccbaced4a0780286864af590dcd30cce8ac245`. Their parents, Overwatch identities, literal subjects,
and four-file then three-file governance scopes are pinned exactly and in order.

This Infrastructure admission follows only `4d7f5d1` and is intentionally dynamic to avoid a
self-referential commit claim. It requires the exact Infrastructure author and committer identity,
literal subject `infrastructure: admit deployment authorization boundary repair`, and only this
verifier, focused test, documentation, and Infrastructure contract. Regression fixtures reject a
wrong identity, parent, file set, merge, reordered governance pair, or missing governance member.
No deployment, workflow dispatch, Cloudflare contact, secret access, production mutation, product
change, CRM change, rollback change, or private Worker change is admitted.

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

All recorded failed runs, the readiness successor, and the Dashboard test-only successor remain
immutable evidence. The safe CI and deployment workflow runs are consumed and are not retried by
this owner task. This repair does not
authorize a workflow dispatch, push, deployment, CRM submission, secret access, or production
change.
