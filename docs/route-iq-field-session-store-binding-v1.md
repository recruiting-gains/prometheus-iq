# Route IQ Field Session Store Binding v1

Date: 2026-07-11

## Ownership

- Production Worker: `prometheus-iq`
- Wrangler configuration: `wrangler.jsonc`
- Environment: private Route IQ production Worker behind the existing Cloudflare Access application
- Binding: `DATA_ROUTE_IQ_FIELD_SESSION_STORE`
- Binding provisioning owner: Prometheus Infrastructure
- Namespace data owner: Prometheus Data
- Workspace scope: `fitness_connection` only
- Canonical Data contract: `overwatch/artifact-contracts/data/fitness-connection-runtime-artifact-contract-v1.json`
- Canonical archive adapter: `data/route-iq-field-sessions-v1/route-iq-field-session-archive.mjs`

The namespace identifier is intentionally recorded only in the approved private Worker Wrangler configuration. It is not repeated in this report or other public-facing material.

## Architecture Decision

The binding belongs only to the existing `prometheus-iq` Worker. That Worker owns the private Route IQ application origin and is the future same-origin recipient for the separately authorized Dashboard end-of-day handoff. The public `prometheusrouteiq-website` Worker does not receive this binding. No new Worker, service, route, trigger, Dashboard behavior, CRM behavior, scoring behavior, or Intelligence consumer was created.

The namespace is dedicated to Fitness Connection Route IQ field-session archival. It is separate from CRM, shared lead intake, Instagram token, Aegis rate-limit, and business-hours storage. The canonical Data adapter recognizes only `fitness_connection`; every inactive, historical, or unknown workspace fails closed. A future workspace requires its own separately approved namespace and binding design.

## Development And Preview

The repository's existing Wrangler convention declares production namespace IDs in the production config and uses local KV simulation for local development. No shared remote preview namespace or `preview_id` was added. This prevents verification or development records from crossing workspaces or entering the production session keyspace.

## Verification Path

Local contract and runtime validation:

```bash
npm run test:private
```

Disposable production namespace probe:

```bash
npm run infrastructure:field-session-store:remote
```

The remote probe resolves the namespace through the Wrangler binding name, writes a short-lived technical record below `_infrastructure-verification/`, reads it back in a separate Wrangler operation, lists it by its unique prefix, and deletes it. The probe never writes under `route-iq-field-sessions/v1`, contains no customer, route, visit, lead, or representative data, and has a five-minute TTL as a cleanup fallback.

The canonical Data tests separately prove identical replay idempotency, conflicting-evidence rejection, unknown-workspace and cross-workspace fail-closed behavior, append-only raw evidence, separate-adapter read-back, and commit-marker-last visibility. These checks use the committed July 11 archive in memory and do not replay or backfill it into production.

## Provisioning Verification Result

The production namespace was created on 2026-07-11 and verified through the configured binding name. The disposable remote probe passed separate-operation write/read-back and binding-scoped list checks, then deleted its technical record and confirmed the unique verification prefix was empty. The canonical session keyspace was not touched and no customer, route, visit, lead, or representative data was written.

The focused Infrastructure suite also confirmed that existing bindings remain present, the public Worker is not bound to this namespace, missing bindings fail before writes, only `fitness_connection` is supported, inactive and unknown workspace access fails closed, raw evidence is written first and remains unchanged on conflict, identical replay performs no second write, and the commit marker is written last.

## Deployment Gate

The namespace is provisioned and the local configuration is ready for independent OVERWATCH review. The updated Worker configuration must not be pushed or deployed until OVERWATCH verifies this implementation. Until deployment, the canonical Data contract correctly remains marked as pending production binding, and no automatic Dashboard submission path exists.
