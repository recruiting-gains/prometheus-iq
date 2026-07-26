# GitHub Actions Private Worker Deployment Governance v2

Prometheus Overwatch independently accepts the Infrastructure-owned immutable
private Worker release lane introduced by commit
`5c9621e29c4d613e997c8fee3c75d67c6fd0828c`, including its
Infrastructure-owned secret-scan fixture repair
`266fb19637fc11dc0c27e42bbfc7a1816cc7cdad` and its independently reviewed
bootstrap-guard repair
`a5ae6578bc0c030def8df5d4713d5ecbe5206212` and runner-workspace repair
`254fea23e18fec27228e15e75986a1c6bb3dffd6`. Overwatch also accepts the exact
Infrastructure successor chain that canonicalizes the trusted default temporary
alias in `6a764ad86ad4f99e0bd9ed835c8f1aba20f91a3b` and isolates Wrangler scratch
output in `947720badd46cb053c6e199b96b3739180b26690`. The Node 24 portability
successor `1341e8edf6e96603437b7bff95768531e2f5446a` changes only the
Infrastructure-owned Workflow v2 test fixture. The canonical-smoke successor
`dfa52c70cd48b33771d6c85de6483c499d9b038f` removes the noncanonical
`/index.html` asset alias from the fixed smoke plan while preserving universal
redirect denial. Infrastructure then narrowed the implementation through
`a4572b351473bf5c0183d748434d77de04d882f0`,
`c7bbf6413430da2e55f94041bba70fcbdb4a95ba`, and
`b64f6f05940bdf24ba57dfe488f567853e0c3d22` so the shared public Worker bundle
and private forward-payload identity remain unchanged. The release-propagation
successors `a83e069016622d968702c4db40c251ccbff744dd` and
`25ff53a7e61b50962144c5c689cc7a546875f724` bind postdeployment readiness
to the exact Cloudflare Worker version without changing the approved Dashboard
experience. Infrastructure successor
`6f7216afa09b72442f53a271a8b9fc749aa34d4b` then routes the canonical rollback
root through that same authenticated guard and version proof. Infrastructure
successors `c217ad43e4dbae32690661463eb6cfa38a19e95c` and
`b540084521c87ccad85b41b5e9d1714a497f73e0` make the complete fixed smoke plan
the propagation fence, align forward and rollback asset routing, and pin the
materialized clean-runner payload identity. Infrastructure successor
`ceea5b6496f81341a49f605622d78daf084d9f6f` then replaces the selective
route-pattern boundary with unconditional boolean Worker-first routing and
replaces the premature attempt count with a measured monotonic deadline.

## Corrective

The legacy private deployment workflow rebuilt the current `main` checkout and
its qualification artifact did not contain an independently deployable forward
payload. It therefore could not consume the previously qualified private
Dashboard release without substituting a newer repository state.

The v2 lane fixes that defect by qualifying the actual no-bundle Worker payload,
assets, configuration, manifest, and paired forward-compatible rollback. The
deployment lane downloads that exact artifact, verifies every pinned identity,
and deploys it without rebuilding.

The first protected deployment run, `30187966068`, failed before production
mutation. The retained private Worker predates the runtime guard, while the
predeployment smoke gate required a guard response before the successor that
implements the guard could be installed. The Infrastructure successor permits
only that pinned retained version to omit the predeployment marker. It still
requires the exact service principal and fixed GET/HEAD request contract, and
postdeployment smoke always requires the marker.

The successor injects the four governed runtime guard settings through an
exclusive `0600` temporary config inside an owner-only `0700` directory. It
does not alter the qualified application payload or assets, cleans the
temporary material in `finally`, and verifies an additive binding transition
that preserves every preexisting binding and rejects unexpected additions,
deletions, or type changes.

Protected runs `30189780921` and `30191466442` passed immutable preflight and
then failed closed with `RUNTIME_GUARD_WORKSPACE_INVALID` before production
mutation. The original claim that the GitHub runner temporary alias was rejected
before Wrangler started is superseded. The trusted default temporary alias had
already been canonicalized in the second run, which advanced through a
successful real Wrangler dry run.

Wrangler 4.110.0 created project-local `.wrangler` scratch beneath the guarded
forward runtime directory. The required post-dry-run tree and byte
reverification correctly rejected that unapproved entry before the forward
deployment Wrangler process could spawn. No production mutation occurred and
no rollback was required.

The final Infrastructure successor gives dry-run, deployment, and rollback one
fixed, distinct `--outdir` apiece inside an owner-only `0700` scratch directory
that is a sibling of the guarded forward and rollback roots. Those paths are
not user-controlled, reject symlinks, are cleaned with the runtime workspace,
and do not allow `.wrangler` or any other new entry inside either guarded
payload root. The `0600` runtime configs, exact guard markers, payload byte
identity, one deployment/rollback ceiling, and authenticated GET/HEAD-only
smoke boundary remain unchanged.

The release-blocking local verifier executes a real no-secret Wrangler 4.110.0
dry run and proves the guarded roots remain unchanged afterward. The same gate
must pass on a clean `ubuntu-24.04` GitHub runner with Node 24 before a new
qualification can be accepted.

Qualification run `30193359749` reached that gate and failed before artifact
creation or production access. The symlink-substitution assertion had already
passed, but its cleanup used `rmSync` on a directory symlink. Node 24.4.1
returned `ERR_FS_EISDIR`; the same cleanup happened to succeed under Node 25.
The owner fixture now removes the known symlink with `unlinkSync` before
recreating the directory. This is a test portability repair only: the symlink
attack remains rejected, the real Wrangler test remains mandatory, and no
runtime, payload, or production boundary changed. Fresh clean-runner evidence
is pending; this governance update does not claim qualification or deployment.

Protected runs `30197730489`, `30199390518`, `30199552708`, and `30199655532`
failed before production mutation with `REDIRECT_DENIED`. Cloudflare Access
allowed the exact replacement service principal, but Workers static assets
canonicalized `/index.html` to `/` with an HTTP 307 response. The redirect
guard therefore worked as designed.

The Infrastructure successor keeps that guard fail-closed and changes the
fixed client plan to request only the canonical root HTML path. It does not
follow same-origin or other redirects. A Miniflare integration test delegates
through the exact Worker-first asset configuration and proves `/` returns HTTP
200 while `/index.html` returns the rejected HTTP 307 canonicalization
response.

The first repair also changed the shared public Worker bundle because both
Workers reuse the same runtime guard module. The final successor restores the
historical read-only guard alias byte-for-byte and filters it only in the
non-Worker smoke client. The deterministic public rollback bundle remains
`f8fceee62838c182a4e093d4d8bc57c71bf5ec8dbe71707db76c63ecd7a4b1eb`,
and the private forward payload returns to its prior qualified identity.

Deployment run `30205110247` crossed the production mutation boundary, then
failed closed when its first immediate Access-authorized 2xx root response did
not contain the runtime guard marker. The workflow executed its one qualified
forward-compatible rollback and verified the rollback; the public Worker was
unchanged.

The release-propagation successor now requires both the exact runtime guard
marker and the exact Cloudflare Worker version supplied by the
`CF_VERSION_METADATA` binding before the full smoke plan may start. The same
version is required on every full-smoke response, so an older Worker cannot pass
by serving byte-identical HTML. Only a missing marker or missing or stale version
may wait within the fixed 46.5-second readiness window. Redirects, non-2xx
responses, malformed markers or versions, transport failures, and deadlines fail
into the one qualified rollback. Fetch, response inspection, and response-body
cancellation share one deadline for readiness and every full-smoke request.
Neither credential material nor release identity values are emitted.

Independent review found that the forward-compatible rollback originally sent
only `/api/*` through its generated Worker wrapper, while the readiness probe
uses canonical `/`. The rollback root could therefore bypass the guard marker
and `CF_VERSION_METADATA` proof. Infrastructure repaired the rollback routes so
only canonical `/` and the existing `/api/*` namespace are Worker-first. A
composed regression test now proves an authenticated rollback root response
contains both the exact marker and exact Worker version; ordinary assets,
Dashboard behavior, bindings, and migrations remain unchanged.

Deployment run `30210281673` then proved the remaining gap. The canonical root
converged on the guarded release, but a later fixed static-asset probe did not
carry the guard marker. The previous readiness fence had proved only `/`, while
the acceptance plan covered fifteen GET/HEAD probes and forward and rollback
used different `assets.run_worker_first` representations. The workflow failed
closed, executed its one forward-compatible rollback, and verified private
production on version `9ffb32d3-313a-4209-ad1d-0a6702ba8a83`; the public Worker
remained unchanged.

The first guard-convergence successor used the same selective `["/*"]`
Worker-first boundary in forward and rollback. Every bounded propagation
attempt evaluated the whole fixed GET/HEAD plan and accepted only when every
probe carried the exact marker and exact Worker version. Only missing or stale
propagation evidence could wait; redirects, non-2xx responses, invalid markers
or versions, and transport failures failed immediately.

The first owner commit recorded a payload digest generated with a symlinked
dependency tree. The pin-only Infrastructure successor regenerated with a
materialized dependency tree matching the clean GitHub runner and fixed the
exact forward payload identity to
`d7b4837187a55132ece120262373ee9bda3293159eb7c822aa2365d32f27af97`.
The paired rollback identity is
`f2edb9475f09fcf9b3469c133585c82333c218d0f6efe9f696d192665a8bf8df`.
No runtime behavior changed in the pin-only successor.

Deployment run `30213341082` crossed the production mutation boundary and
failed closed at `RUNTIME_POOLS_GET` with
`GUARD_PROPAGATION_TIMEOUT`. Its valid 2xx response lacked the exact guard
marker, proving that the selective `["/*"]` asset route did not establish the
required unconditional Worker boundary for every cached static asset. The same
run also exposed that twelve fast attempts exhausted after roughly 16.5 seconds
even though the contract advertised a 46.5-second convergence window. The
workflow executed and verified the qualified forward-compatible rollback;
private production returned to
`9ffb32d3-313a-4209-ad1d-0a6702ba8a83` and the public Worker remained
unchanged.

The corrective requires `assets.run_worker_first: true` in forward and
rollback and rejects every array substitute, including `["/*"]`. Its smoke
fence measures a monotonic 46.5-second deadline rather than counting attempts.
The complete fixed GET/HEAD plan must still converge in one round, and unsafe
responses still fail immediately. The corrected forward payload identity is
`81bb2e724ce7433c591f7241c043b69ea329a5ecd15fe0045ed58bb37d77cb7c`;
the paired rollback identity is
`0350e6281b228321509c59fadc1fe612f6400b6d025c27dddd01ea980daddb79`.

## Boundary

- Target: `prometheus-iq` only.
- Public Worker mutation is prohibited and checked before and after mutation.
- Qualification has no production credentials or Cloudflare request path.
- Deployment requires a clean synchronized `main`, exact commit and tree, exact
  qualification run and artifact identities, exact current Worker identities,
  and the Founder actor on the first workflow attempt.
- Wrangler uses `--no-bundle`, `--keep-vars`, and `--strict`; `--name` is
  prohibited. Every phase also requires its fixed isolated `--outdir`.
- One forward deployment attempt is permitted. There is no retry.
- Critical failure permits one paired forward-compatible rollback; native
  rollback is prohibited.
- Automated smoke requests are authenticated GET or HEAD only, use canonical
  paths, reject every redirect, and permit zero attempted application writes.
- The postdeployment readiness window evaluates the complete fixed GET/HEAD
  plan. Every probe must prove the exact guard marker and deployed Worker
  version in one converged attempt. Forward and rollback use unconditional
  boolean Worker-first routing, and the bounded wait is measured by a monotonic
  clock rather than an attempt count.
- Collection, cohorts, recommendation influence, availability refresh,
  customer activation, Anthony mapping, the public Worker, and CRM remain
  outside this release.

## External Readiness

A name-only audit found the protected environment main-only and all six
contract-required settings present:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_ACCESS_CLIENT_ID`
- `CLOUDFLARE_ACCESS_CLIENT_SECRET`
- `PROMETHEUS_UNATTENDED_SMOKE_ACCESS_TEAM_DOMAIN`
- `PROMETHEUS_UNATTENDED_SMOKE_ACCESS_AUDIENCE`

The dedicated Cloudflare Access Service Auth policy is attached to the existing
private application under policy ID
`14fc787c-beb8-4abc-9923-8eaa9ae7d3d3`. Existing owner access and unrelated
credentials remain unchanged. Credential values were handled only through the
authenticated Cloudflare and GitHub interfaces and were not printed, logged,
committed, or included in this record.

The deployment command checks all six names before making any Cloudflare
request. Source qualification remains independent of their values.
