# GitHub Actions Private Worker Deployment Governance v2

Prometheus Overwatch independently accepts the Infrastructure-owned immutable
private Worker release lane introduced by commit
`5c9621e29c4d613e997c8fee3c75d67c6fd0828c`, including its
Infrastructure-owned secret-scan fixture repair
`266fb19637fc11dc0c27e42bbfc7a1816cc7cdad`.

## Corrective

The legacy private deployment workflow rebuilt the current `main` checkout and
its qualification artifact did not contain an independently deployable forward
payload. It therefore could not consume the previously qualified private
Dashboard release without substituting a newer repository state.

The v2 lane fixes that defect by qualifying the actual no-bundle Worker payload,
assets, configuration, manifest, and paired forward-compatible rollback. The
deployment lane downloads that exact artifact, verifies every pinned identity,
and deploys it without rebuilding.

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

A read-only name audit found the protected environment main-only and found
`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCESS_CLIENT_ID` present. The required
`CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_ACCESS_CLIENT_SECRET` names were absent.
No value was accessed.

The v2 deployment command checks all four names before reading credentials or
making any Cloudflare request. Deployment therefore remains fail-closed until
the two missing protected values are supplied through an authorized external
credential procedure. Qualification is independent of those values.
