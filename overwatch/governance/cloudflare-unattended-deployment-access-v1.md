# Cloudflare Unattended Deployment Access Governance v1

Batch: `BATCH-20260714-005`

Owner: Prometheus Overwatch

Status: architecture verified; setup not configured.

Prometheus Infrastructure owns the credential, local-storage, Founder-control, and read-only-smoke architecture in `workers/infrastructure/cloudflare-unattended-deployment-access-v1.json`. Overwatch owns only the independent governance, verification, registry, and release boundary around that implementation.

## Governing boundary

- Automatic engineering push is never deployment authorization.
- Every deployment still requires a Founder directive naming the exact commit, tree, environment, release scope, and rollback plan.
- The only future unattended deployment target is the private `prometheus-iq` Worker. The public `prometheusrouteiq-website` Worker is denied.
- Missing, invalid, stale, reused, target-mismatched, or OFF local control denies deployment before Wrangler starts.
- The control file and credentials are independent requirements; neither authorizes deployment by itself.
- Cloudflare API-token and Access Service Token credentials must remain separate.
- Cloudflare Access authentication is not an HTTP read-only control. Unattended smoke remains blocked until a separately authorized server-side service-principal guard and default-deny smoke client are implemented and verified.
- Secret values, lengths, hashes, prefixes, metadata, screenshots, browser storage, service-worker storage, shell history, command-line arguments, repository files, and reports are prohibited.

## Current release decision

The architecture may be committed and automatically pushed after exact-version verification. No Cloudflare login, token creation, service-token creation, Access policy change, Keychain value read, deployment, production mutation, collection activation, cohort activation, or recommendation influence is authorized by this batch.

Current setup is `NOT_CONFIGURED`. Unattended deployment readiness and unattended smoke readiness are both `false`. Deployment recommendation is `DO_NOT_DEPLOY`.
