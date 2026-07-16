# GitHub Actions Founder-Triggered Private Worker Deployment Governance v1

`BATCH-20260715-010` replaces the blocked local Keychain retrieval path with a
manual GitHub Actions release path. Prometheus Infrastructure owns the workflow,
controller, contract, tests, and Founder setup documentation. Prometheus Overwatch
owns this governance record, independent checks, artifact registration, release
wiring, and push decision.

The workflow has exactly one trigger: `workflow_dispatch`. It is fixed to
`PrometheusRouteIQ/prometheus-iq`, branch `main`, and private Worker
`prometheus-iq`. The public `prometheusrouteiq-website` Worker is a read-only
before/after comparison and cannot be passed to Wrangler. GitHub permissions are
`contents: read`; Cloudflare mutation authority comes only from the four protected
environment values and exists only inside the approved deployment job.

The protected environment is named `prometheus-private-worker-production`. The
Founder must configure its required reviewer, restrict it to `main`, and enter the
four Cloudflare values directly in GitHub. Source installation does not configure
that environment, attach an Access policy, deploy a Worker, or read any secret.

Every dispatch must name the current `origin/main` commit, its tree, the governed
batch ID, and the current private Worker version. The checked-out GitHub SHA, local
HEAD/tree, local `origin/main`, branch, repository identity, worktree, index, and
Git object graph must match. Verification runs without deployment secrets. The
environment-gated job then repeats identity checks, reads the current private and
public deployment identities, performs a fixed dry run, checks for concurrent
movement, and permits one strict `prometheus-iq` deployment with `--keep-vars`.

The fixed service-principal smoke profile permits only its governed GET/HEAD
requests and runs before and after deployment. The new private deployment must be
the sole 100-percent version; both public deployment ID and public version ID must
remain unchanged. Collection remains OFF, active cohorts remain zero, and
recommendation influence remains OFF.

The initial seven-commit local chain and its six diagnostic files were not pushed.
Infrastructure preserved that evidence on local-only branch
`codex/archive/batch-20260715-010-keychain-acl-diagnostics`; it is outside the
release range and may not be merged, cherry-picked, or pushed as part of this
batch.

Rollback is forward-only. Source rollback uses new `git revert` commits in reverse
release order followed by complete verification. Any future production rollback
uses a separately Founder-approved forward-revert commit and tree through this same
manual workflow. Native Cloudflare rollback and Git history rewriting remain
prohibited.
