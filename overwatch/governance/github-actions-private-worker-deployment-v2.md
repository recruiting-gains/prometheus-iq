# GitHub Actions Private Worker Deployment Governance v2

Prometheus Overwatch independently accepts the Infrastructure-owned immutable
private Worker release lane introduced by commit
`5c9621e29c4d613e997c8fee3c75d67c6fd0828c`, including its
Infrastructure-owned secret-scan fixture repair
`266fb19637fc11dc0c27e42bbfc7a1816cc7cdad` and its independently reviewed
bootstrap-guard repair
`a5ae6578bc0c030def8df5d4713d5ecbe5206212` and runner-workspace repair
`254fea23e18fec27228e15e75986a1c6bb3dffd6`.

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

The next protected run, `30189780921`, passed immutable preflight and then
failed with `RUNTIME_GUARD_WORKSPACE_INVALID` before Wrangler started. The
GitHub-hosted runner temporary environment path may be an alias, which the
no-symlink workspace guard correctly rejected. The Infrastructure repair uses
`node:os.tmpdir()` as the validated base, creates a fresh exclusive owner-only
workspace there, and ignores `RUNNER_TEMP` for runtime guard material. The
repair does not allow aliases or symlinks, does not weaken file modes, and does
not change the qualified Dashboard, Worker, or rollback payload.

## Boundary

- Target: `prometheus-iq` only.
- Public Worker mutation is prohibited and checked before and after mutation.
- Qualification has no production credentials or Cloudflare request path.
- Deployment requires a clean synchronized `main`, exact commit and tree, exact
  qualification run and artifact identities, exact current Worker identities,
  and the Founder actor on the first workflow attempt.
- Wrangler uses `--no-bundle`, `--keep-vars`, and `--strict`; `--name` is
  prohibited.
- One forward deployment attempt is permitted. There is no retry.
- Critical failure permits one paired forward-compatible rollback; native
  rollback is prohibited.
- Automated smoke requests are authenticated GET or HEAD only and permit zero
  attempted application writes.
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
