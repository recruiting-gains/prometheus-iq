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

This declaration targets the public `prometheusrouteiq-website` Worker only. The Infrastructure verifier pins the complete current public configuration, its historical predecessor identity, and the raw private `prometheus-iq` Wrangler configuration. The only admitted semantic successor is the `main` entry change from `workers/prometheus-iq-worker.js` to `workers/infrastructure/prometheusrouteiq-website-entry.mjs`. Replacing that adapter, changing its exact export surface, or changing any other public top-level value fails closed.

The adapter exports only the default fetch handler and `RouteIqRequestCrmCoordinator`. The public Durable Object binding and additive `route-iq-request-crm-sqlite-v1` migration remain intact. No binding, migration, variable, asset path, Worker identity, apex or www custom domain, Access/WAF boundary, or private/public target boundary changed. `workers_dev` and `preview_urls` remain explicitly disabled.

## Runtime boundary

These source settings do not change the live Cloudflare account until a separately authorized deployment applies the public configuration. No deployment or Cloudflare mutation occurred. No GitHub workflow, credential, CRM record, Worker binding, route, traffic allocation, or production data was accessed or changed by this owner task.

Run the owner verification directly:

```sh
node scripts/verify-route-iq-public-crm-edge-boundary-infrastructure.mjs
node --test tests/route-iq-public-crm-edge-boundary-infrastructure.test.mjs
```

The existing forward rollback artifact remains a new forward deployment. Its Infrastructure-owned configuration hash advances to `5b8e16a1e49172f20ef617d09e6e655b5ee453600b486fe5d216ebe5453b56f0` with this intended entry adapter while its Durable Object class, binding, migration history, namespace, and accepted-record preservation rules remain unchanged.
