# Founder-triggered public Worker deployment v1

## Boundary

`Deploy Prometheus Public Worker` is a manual `workflow_dispatch` release path for `prometheusrouteiq-website` only. It cannot run on push, schedule, repository dispatch, workflow call, or another Worker target. The no-secret verification job requires the Founder GitHub actor, `main`, the exact commit, tree, Batch ID, current public version, current private version, forward-rollback artifact SHA-256, and the exact authorization phrase. A rerun is rejected.

The deployment job uses the protected `prometheus-public-worker-production` environment only after verification succeeds. It reads five environment secret names:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `ROUTE_IQ_REQUEST_CRM_ACCESS_TEAM_DOMAIN`
- `ROUTE_IQ_REQUEST_CRM_ACCESS_AUDIENCE`
- `ROUTE_IQ_REQUEST_CRM_FOUNDER_SUBJECT_SHA256`

Values are never stored in source, artifacts, command arguments, or logs. The three Founder settings are uploaded additively as encrypted Worker secret bindings. `--keep-vars` preserves dashboard variables, Wrangler preserves omitted secrets, and `--strict` rejects conflicting remote changes. Before mutation, the workflow inventories all live public bindings and rejects any binding that cannot be proven preserved by the exact config, `--keep-vars`, or Wrangler's additive secret behavior. The command uses only `wrangler.prometheusrouteiq-website.jsonc`; there is no `--name` override.

## Cloudflare version finding

Cloudflare Workers configuration is versioned with Worker code. Adding variables or secrets creates a new Worker version, and dashboard variable changes require deployment to take effect. Therefore the three Founder settings cannot be attached while retaining the current live public Worker version. They are intentionally applied only with the separately Founder-approved public release. This batch does not alter live version 40 or contact Cloudflare.

Official behavior references:

- <https://developers.cloudflare.com/workers/versions-and-deployments/>
- <https://developers.cloudflare.com/workers/configuration/environment-variables/>
- <https://developers.cloudflare.com/workers/wrangler/configuration/>
- <https://developers.cloudflare.com/workers/wrangler/commands/workers/>

## One-time GitHub setup

1. Create the private environment `prometheus-public-worker-production`.
2. Restrict deployments to the `main` branch.
3. Enter the Cloudflare deployment API token and account identifier directly as the first two environment secrets above.
4. Complete the attended Founder principal procedure in `docs/route-iq-public-crm-founder-access-v1.md`; its local tool writes the remaining three names without showing values.
5. Confirm the environment contains all five names. Do not copy values into a terminal, repository file, issue, chat, screenshot, or artifact.

The API token must be restricted to the exact Prometheus account and the permissions needed to read Worker versions/settings and deploy `prometheusrouteiq-website`. It must not authorize Access-policy mutation or unrelated account resources.

## Release sequence

1. Verify the candidate at the exact pushed `main` commit and tree.
2. Run `node scripts/verify-route-iq-public-forward-rollback.mjs` twice and record the identical SHA-256.
3. Confirm the current public and private version UUIDs independently.
4. Dispatch `Deploy Prometheus Public Worker` from the Founder account with all exact inputs.
5. The workflow runs the repository suite and owner gates without secrets.
6. The environment-backed job re-verifies the exact release, runs GET/HEAD-only smoke, reads both Worker versions and bindings, performs one Wrangler dry run, rechecks both Workers, performs one public deployment, and confirms the private Worker did not change.
7. The workflow repeats the GET/HEAD-only smoke and exact repository verification.

No production request form is submitted by the workflow. Founder CRM paths must redirect to Cloudflare Access when unauthenticated. Collection remains OFF, active cohorts remain zero, and recommendation influence remains OFF.

## Forward rollback

The rollback is a new deployment, never a native Cloudflare rollback. The deterministic rollback workspace combines the current stateful Worker, CRM implementation, Durable Object class, binding, and migration history with the prior public website assets from commit `cb413fdf3a9676c238c02532261ffcf3a24f2b21`. This restores the prior website experience while preserving accepted CRM records and all SQLite migration history.

Generate and verify it with:

```sh
node scripts/verify-route-iq-public-forward-rollback.mjs
```

Rollback requires a separate Founder dispatch using a commit that contains the verified forward-compatible rollback source. Do not delete the Durable Object class, binding, namespace, migration, settings, or accepted records.
