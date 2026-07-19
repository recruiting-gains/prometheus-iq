# Route IQ public CRM edge boundary Infrastructure v1

## Source declaration

The public `prometheusrouteiq-website` Worker configuration explicitly sets:

- `workers_dev`: `false`
- `preview_urls`: `false`

Cloudflare documents `workers_dev` as the control for the stable `workers.dev` route and `preview_urls` as the independent control for version and alias preview URLs. Keeping both values explicit prevents a later Wrangler deployment from restoring either public exposure through a default.

References:

- <https://developers.cloudflare.com/workers/configuration/routing/workers-dev/>
- <https://developers.cloudflare.com/workers/versions-and-deployments/preview-urls/>
- <https://developers.cloudflare.com/workers/wrangler/configuration/>

## Ownership and preservation

This declaration targets the public `prometheusrouteiq-website` Worker only. The Infrastructure verifier pins the complete public configuration, the semantic content that existed before the two edge flags, and the raw private `prometheus-iq` Wrangler configuration. A change to the public assets, bindings, migrations, variables, KV namespaces, email binding, runtime entrypoint, or Worker name fails closed. Any private Worker configuration change also fails closed.

The public Durable Object binding and additive SQLite migration remain intact. No binding, migration, variable, asset path, Worker entrypoint, or private/public target boundary changed.

## Runtime boundary

These source settings do not change the live Cloudflare account until a separately authorized deployment applies the public configuration. No deployment or Cloudflare mutation occurred. No GitHub workflow, credential, CRM record, Worker binding, route, traffic allocation, or production data was accessed or changed by this owner task.

Run the owner verification directly:

```sh
node scripts/verify-route-iq-public-crm-edge-boundary-infrastructure.mjs
node --test tests/route-iq-public-crm-edge-boundary-infrastructure.test.mjs
```

The existing forward rollback artifact remains a new forward deployment. Its Infrastructure-owned configuration hash advances with this public configuration while its Durable Object class, binding, migration history, and accepted-record preservation rules remain unchanged.
