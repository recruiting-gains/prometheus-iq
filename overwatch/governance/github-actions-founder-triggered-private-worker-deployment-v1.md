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
Founder must restrict it to `main` and enter the four Cloudflare values directly in
GitHub. Required-reviewer protection is unavailable for this private repository,
so it is not represented as a control. Source installation does not configure that
environment, attach an Access policy, deploy a Worker, or read any secret.

## Private Repository Compatibility Successor

`BATCH-20260715-011` preserves the original release architecture while replacing
the unavailable required-reviewer assumption with an exact authenticated Founder
dispatch. Prometheus Infrastructure implemented the successor in commit
`38e983b6d0a121d8aadf443938ab5985771eddac`; Prometheus Overwatch independently
verifies it and did not modify Infrastructure-owned implementation.

The no-secret verification job requires `github.actor` and
`github.triggering_actor` to both equal `PrometheusRouteIQ`, the workflow ref and
runtime ref to identify `main`, and `github.run_attempt` to equal one. It also
requires the exact nonsecret phrase `I AUTHORIZE THIS EXACT PROMETHEUS PRIVATE
WORKER DEPLOYMENT` and exactly the five governed inputs. A rerun is therefore not a
fresh approval and fails closed.

Only a successful preflight can schedule the job that references
`prometheus-private-worker-production`. Environment secrets are not referenced by
the preflight and remain available only to the environment-backed deployment job.
The environment's selected deployment branch rule must remain exactly `main`.
There is no push, schedule, pull-request, `repository_dispatch`, `workflow_call`,
`workflow_run`, rerun, or approval-bypass deployment path.

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
