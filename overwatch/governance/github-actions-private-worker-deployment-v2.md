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
redirect denial.

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
fixed plan to request only the canonical root HTML path. It does not follow
same-origin or other redirects. A Miniflare integration test delegates through
the exact Worker-first asset configuration and proves `/` returns HTTP 200
while `/index.html` returns the rejected HTTP 307 canonicalization response.
The noncanonical alias is not allowlisted.

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
