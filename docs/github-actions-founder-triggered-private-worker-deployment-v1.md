# GitHub Actions Founder-Triggered Private Worker Deployment v1

## Status and Boundary

This is Prometheus Infrastructure source for `BATCH-20260715-011`. It is
`PRIVATE_REPOSITORY_COMPATIBILITY_IMPLEMENTED_NOT_EXECUTED`: No deployment was performed,
no Cloudflare or GitHub API was mutated, no secret was entered, no Keychain was read,
and no production setting was changed in this implementation batch. Prometheus
Overwatch owns later release wiring and governance review.

The workflow is fixed to repository `PrometheusRouteIQ/prometheus-iq`, branch `main`,
and private Worker `prometheus-iq`. The public Worker
`prometheusrouteiq-website` is a read-only before/after comparison target and can
never be selected for deployment. The blocked Keychain diagnostic archive is not a
source for this workflow.

## Control Flow

`Deploy Prometheus Private Worker` has only a manual `workflow_dispatch` trigger.
The Founder supplies five required strings: the exact approved commit, its exact
tree, the batch ID, the current production version UUID, and the fixed nonsecret
confirmation `I AUTHORIZE THIS EXACT PROMETHEUS PRIVATE WORKER DEPLOYMENT`. The
workflow rejects anything except a 40-character lowercase commit and tree, a
`BATCH-YYYYMMDD-NNN` batch, a canonical lowercase UUID, and that exact phrase. The
event payload must contain exactly those five input names with identical values.

The secret-free verification job requires `github.actor` and
`github.triggering_actor` to both equal `PrometheusRouteIQ`. It requires the exact
repository, workflow name, workflow file, `main` branch/ref, first run attempt,
manual event, and input set before validating checked-out HEAD, tree, origin URL,
local `origin/main`, worktree, index, and Git object integrity. A rerun is rejected;
the Founder must make a fresh authenticated dispatch and re-enter current inputs.
The job then runs the complete repository test, lint, typecheck, security, Aegis,
cross-subsystem contract, build, secret-scan, and Infrastructure owner gates.

The pinned `actions/setup-node` steps omit both supported caching inputs, `cache` and
`cache-dependency-path`, so dependency caching remains disabled. The workflow does
not use the unsupported `package-manager-cache` input.

The environment-backed deploy job starts only after the secret-free verification
job returns success. The environment is still fixed to
`prometheus-private-worker-production`, but required-reviewer protection is
unavailable for this private repository. The authenticated Founder dispatch, exact
phrase, first-attempt guard, and exact release inputs are the explicit deployment
approval signal. The deploy job repeats repository and configuration verification
before network use. A fixed GET reads Cloudflare's deployments endpoint for the
private and public Workers.
The first deployment must contain exactly one version at 100 percent, and the
private version must equal the Founder input. Any redirect, timeout, malformed or
oversized envelope, split traffic, stale version, or concurrent change fails
closed.

Wrangler is the lockfile-pinned local `4.120.1` module. The workflow first executes
the equivalent of:

```text
wrangler deploy --dry-run --config wrangler.jsonc --name prometheus-iq --keep-vars --strict
```

It then repeats the remote version comparison and local repository check before one
equivalent command without `--dry-run`. Message and tag values are bounded and
derived only from validated Founder inputs. There is no caller-controlled command,
target, config, environment, URL, or extra argument. `--keep-vars` and the reviewed
private config preserve dashboard variables and secrets while retaining the
existing assets, KV, email, Durable Object bindings, vars, and migrations.

After deployment, the new private version must be the sole 100-percent version and
the public deployment ID and public version ID must both be unchanged from the
pre-deploy snapshot. The existing guarded smoke client runs before and after using
only its fixed GET/HEAD allowlist. It sends no body or cookie, denies redirects,
never reads response bodies, and permits no write method.

The governed source contracts remain `collection: OFF`, `activeCohortCount: 0`, and
`recommendationInfluence: OFF`. Static gates prove those settings. The guarded
bodyless smoke verifies only the runtime surfaces it can safely observe; it does not
invent a production-state claim for data that would require reading a response
body.

## One-Time Founder Setup

1. In repository Settings, open Actions, then General. Set **Actions workflow permissions** to the read-only option for repository contents and packages. Do not grant write permission to the workflow token.
2. Create the protected environment named exactly `prometheus-private-worker-production`.
3. Configure the environment's main-only deployment branch rule. Do not permit tags, release branches, or all-branch deployment. This private repository does not expose the required-reviewer protection used by the earlier design.
4. Enter these four values directly as environment secrets in GitHub: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_ACCESS_CLIENT_ID`, and `CLOUDFLARE_ACCESS_CLIENT_SECRET`. Do not place them in repository variables, files, issue text, workflow inputs, logs, or artifacts.
5. Scope the Cloudflare API token to the exact Prometheus account and the least Workers Scripts read/write permissions needed to read deployments and deploy `prometheus-iq`. Do not grant DNS, Access administration, token administration, KV administration, routes, other accounts, or global-key access.
6. Before enabling this workflow, complete the separately Founder-attended service-auth prerequisite: the existing private Access application must admit only the exact service token, and the existing source guard must be configured and deployed so that the fixed smoke marker is validated and only its GET/HEAD path allowlist can pass. This workflow does not create Access policy or service-token configuration.
7. Keep environment-secret expiry and revocation dates in the Founder-controlled credential register outside Git. No automatic renewal is authorized.

## Founder Dispatch

Open the Actions tab from GitHub on a trusted desktop or phone, choose **Deploy
Prometheus Private Worker**, and choose branch `main`. Enter the exact commit at
current `origin/main`, its exact Git tree, the approved batch ID, and the latest
active private Worker version UUID observed through an attended read-only source.
For the authorization input, type exactly `I AUTHORIZE THIS EXACT PROMETHEUS PRIVATE
WORKER DEPLOYMENT`. Do not enter credentials or account identifiers as inputs.

Clicking **Run workflow** while authenticated as `PrometheusRouteIQ`, with the exact
five inputs, is the explicit Founder approval. Both the original actor and triggering
actor must be that account. Only the first run attempt is valid, so **Re-run jobs**
cannot bypass fresh approval. Concurrency is fixed to
`deploy-prometheus-private-worker`; a second dispatch waits and cannot cancel an
in-progress deployment.

## Failure and Uncertainty

Every deployment-controller failure is a fixed nonsecret classification. Wrangler
output and Cloudflare response bodies and headers are bounded, suppressed, and not
persisted. A timeout or uncertain network result is always failure. The workflow
does not retry a deployment and never attempts automatic rollback. Confirm remote
state through an attended read-only channel before authorizing any later action.

## Forward-Only Recovery

Recovery is a new Founder-approved forward-revert commit and tree deployed through
this same workflow. The Founder supplies the then-current production version UUID,
and every identity, test, approval, dry-run, concurrency, smoke, and public-version
gate runs again. Native Cloudflare rollback, deployment-history selection, Git
history rewrite, amend, reset, and force push are outside this contract.

## Rotation and Revocation

For routine rotation, create replacement Cloudflare credentials with the same narrow
scope, update the four environment secrets directly in GitHub, verify the old values
are no longer referenced, and revoke the old credentials. For emergency revocation,
revoke the Cloudflare API token and Access service token first, then delete or disable
the four GitHub environment secrets. A revoked or absent value must leave the
workflow fail closed. Review the exact Founder account, environment branch rule, and
repository visibility after any Founder or operator change.

## Primary Contracts

- [GitHub workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax)
- [GitHub deployment environments](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments)
- [Cloudflare Workers deployments API](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/deployments/methods/list/)
- [Wrangler deploy command](https://developers.cloudflare.com/workers/wrangler/commands/workers/#deploy)
