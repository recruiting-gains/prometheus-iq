# Route IQ prospective shadow Infrastructure v1

Batch: `BATCH-20260713-004`

Status: implemented and locally verified; collection `OFF`; recommendation influence `OFF`. No push, deploy, or activation was performed.

## Ownership and dependency boundary

Infrastructure wraps the Prometheus Data coordinator verified at commits `7970f240`, `968212e`, `ce9f642`, and `88b8490`. It does not alter Data schema or domain behavior and does not create canonical candidate, session, or opportunity context.

The browser endpoint is `/api/dashboard/route-iq/prospective/event`. While collection is `OFF`, it returns a nonblocking disabled acknowledgment before Aegis, Access/JWKS, Durable Object lookup, or storage. When explicitly enabled with a valid cohort, it authenticates and routes the verified internal scope to the Durable Object, then returns the exact owner dependency blocker `route_iq_prospective_data_server_allocator_required`. Prometheus Data must provide a server-derived canonical session/opportunity allocator and governed candidate-context handoff before collection can advance. Browser signals are not canonicalized or persisted while that dependency is open.

## Binding and migration

- Private Worker binding: `ROUTE_IQ_PROSPECTIVE_SHADOW_COORDINATOR`
- Exported SQLite Durable Object class: `RouteIqProspectiveShadowCoordinator`
- Additive migration: `route-iq-prospective-shadow-sqlite-v1` using `new_sqlite_classes`
- Instance boundary: one object per authenticated workspace + operating profile + internal representative
- Stub name: SHA-256 of only the verified internal scope mapping and routing version
- Public Worker configuration: unchanged; no Durable Object binding or migration

The adapter implements Data's synchronous `executeSchema(sql)`, `execute(sql, bindings)`, and `transactionSync(callback)` repository shape with `ctx.storage.sql` and `ctx.storage.transactionSync`. Schema initialization runs under `blockConcurrencyWhile`. Only domain RPCs are exposed; there is no generic SQL, KV, storage, or `fetch()` RPC.

## Access and authority

The active endpoint requires `Cf-Access-Jwt-Assertion`. `jose` verifies the RS256 signature against the configured team JWKS, exact issuer, application audience, subject, issued-at time, and expiry. Header presence without cryptographic verification is rejected. The verified Access subject is SHA-256 matched to a server-side principal map; raw subject, email, and JWT are never logged or persisted. The map resolves only to internal IDs already present in governed Data records.

Required runtime settings are intentionally named but not valued in source control:

- `ROUTE_IQ_PROSPECTIVE_SHADOW_COLLECTION`
- `ROUTE_IQ_PROSPECTIVE_SHADOW_COHORT_CONFIG`
- `ROUTE_IQ_PROSPECTIVE_SHADOW_ACCESS_TEAM_DOMAIN`
- `ROUTE_IQ_PROSPECTIVE_SHADOW_ACCESS_AUDIENCE`
- `ROUTE_IQ_PROSPECTIVE_SHADOW_PRINCIPAL_MAP`
- `ROUTE_IQ_PROSPECTIVE_SHADOW_AUTHORITY_KEY`
- `ROUTE_IQ_PROSPECTIVE_SHADOW_AUTHORITY_KEY_VERSION`

Missing or invalid global activation/cohort configuration is `OFF`. Once the global and cohort gates are validly `ON`, missing or invalid Access configuration, token, principal map, key, key version, binding, or scope fails closed. Collection activation is independent from recommendation influence, which remains `OFF` in every response and domain receipt.

Infrastructure authority envelopes use keyed HMAC-SHA-256 through Web Crypto. The protected key is required at runtime; the key version produces a non-secret key identifier. No key value appears in source, logs, reports, or documentation. Production timestamps use `Date`; the test suite's clock and generated key material are explicitly noncanonical and never production inputs.

## Browser boundary

The body is limited to 2 KiB and exactly these fields:

- `eventKind`: `next_stop_requested`, `representative_action_observed`, or `representative_outcome_observed`
- `informationalSequence`: optional bounded integer
- `informationalObservedAt`: optional canonical ISO timestamp, informational only

Unknown fields are rejected. In particular, callers cannot provide workspace/profile/representative/session/opportunity IDs, authoritative timestamps, hashes, candidate/source context, eligibility, provenance, seals, engine fields, readiness fields, or recommendation data. Access verification precedes Durable Object lookup. Stub naming never consumes request body identity, session, or opportunity values.

The representative response contains only disabled status or the Data-owner dependency blocker. It does not contain coordinator/session/opportunity IDs, candidates, rankings, probability, confidence, eligibility, readiness, engine internals, seals, or recommendation details.

## Budgets, privacy, and metrics

Per-request and per-object controls bound browser bytes, domain command bytes, SQL statements, rows read/written, candidate/source counts, opportunities per session, events per UTC day, pending outbox entries, principals/cohorts, and database bytes. SQL cursors stop at the row budget, projection recovery processes one outbox entry, and storage uses Cloudflare's `sql.databaseSize` value. There are no unbounded Infrastructure reads.

Structured metrics contain an outcome, HTTP status, and allowlisted event kind only. They contain no email, JWT, Access subject, internal representative ID, key material, candidate/recommendation details, or browser content. This change adds no PII category or retention period and does not persist browser signal content while the Data allocator dependency is open.

## Cost assumptions

`OFF = $0 incremental` for this subsystem: the fast path performs no JWKS request, Durable Object RPC, Durable Object compute/storage operation, Aegis KV operation, or additional bound-service call. The ordinary private Worker request remains part of the existing Worker baseline.

When later enabled, each DO RPC is billable as a Durable Object request. Current official paid-plan assumptions are 1 million requests and 400,000 GB-s included monthly, then `$0.15` per million requests and `$12.50` per million GB-s. SQLite includes 25 billion rows read, 50 million rows written, and 5 GB-month monthly, then `$0.001` per million rows read, `$1.00` per million rows written, and `$0.20` per GB-month. Free-plan daily limits are 100,000 requests, 13,000 GB-s, 5 million rows read, and 100,000 rows written, with 5 GB total storage. Pricing must be rechecked before activation against [Cloudflare Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/).

API and configuration choices follow current Cloudflare guidance for [SQLite Durable Object storage](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/), [Durable Object migrations](https://developers.cloudflare.com/durable-objects/reference/durable-objects-migrations/), [Access JWT validation](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/), [Workers best practices](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/), and [Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/).

## Verification

`npm run infrastructure:route-iq-prospective-shadow:check` verifies source/config invariants and runs Node plus real Miniflare SQLite DO tests. The suite covers OFF zero-call behavior, RS256 Access signature/issuer/audience/expiry validation, principal/cohort mapping, Access-before-DO order, caller authority rejection, stable scope-only routing, missing secret/config behavior, HMAC tamper rejection, concurrent idempotent convergence, durable conflict, cross-scope rejection, candidate budget rejection, and restart persistence.

Release validation also requires Data coordinator tests, existing Worker tests, Aegis/security checks, lint/typecheck/build, Wrangler config validation and dry-run, secret scan, and owned-diff checks.

## Rollback

Before any deployment, a forward-revert removes the Infrastructure code, private binding, and unapplied migration entry.

After a future deployment, first set collection to `OFF`. Then forward-revert endpoint/runtime code while retaining the binding, migration, and class until an authorized retirement plan is approved. Never rewrite migration history and never auto-delete data. A later class/namespace retirement requires explicit Founder and governance authorization.
