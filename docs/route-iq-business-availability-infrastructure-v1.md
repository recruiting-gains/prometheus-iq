# Route IQ business availability runtime v1

Owner: Prometheus Infrastructure

## Boundary

The private `prometheus-iq` Worker contains a deployable but default-OFF business-availability runtime. It adds one SQLite Durable Object class and binding while preserving the prospective-shadow class, binding, migration history, secrets, and safety settings.

The public Worker is outside this runtime. The browser has no refresh or control endpoint. Dashboard reads are authenticated, `GET`/`HEAD` only, and server-derived from the admitted principal's workspace, operating profile, and territory assignments.

## Default-OFF behavior

`ROUTE_IQ_BUSINESS_AVAILABILITY_MODE` is committed as `OFF`. No scheduled trigger is declared. While OFF, missing, malformed, stale, or unauthorized activation state causes:

- zero provider requests;
- zero Data-producer requests;
- zero Durable Object namespace lookups or instantiations;
- zero storage, outbox, timer, or retry work;
- a fixed fail-closed read response.

The production Customer PWA launch remains separately OFF. Prospective collection remains OFF, active cohorts remain zero, and recommendation influence remains OFF.

## Canonical refresh

A future separately authorized scheduler calls only the internal Data producer service binding. The Data producer is responsible for consuming the Integrations-owned GET-only provider adapter and returning the strict Data-normalized runtime snapshot. Infrastructure does not normalize provider payloads and does not decide recommendation eligibility.

Each refresh is bound to:

- canonical workspace and operating-profile IDs;
- a versioned, production-authorized approved-business manifest;
- the immutable manifest artifact hash and configuration version;
- an explicit provider and provider-contract allowlist;
- Data projection, provider-adapter, and normalization-input versions;
- server-derived scheduled batch identity and authoritative record time.

Identical retries return the existing receipt. Changed retries for the same batch are durably recorded as conflicts. The accepted snapshot, transition history, and recovery outbox are committed atomically. The projection marker is written last; pending markers recover idempotently after interruption.

Provider failure records a fixed nonsecret audit code and never replaces or upgrades the last accepted evidence. Runtime snapshot freshness is at most 24 hours. The read view reports fresh or stale state without making a recommendation decision.

## Limits

- 10 configured workspace/profile scopes per activation;
- 1,000 approved records per snapshot;
- 550 append-only daily snapshots per coordinator;
- 768 MiB coordinator storage ceiling;
- 2 MiB command and producer-response ceilings;
- 15-second Data-producer timeout;
- no Infrastructure retry;
- 32 pending recovery-outbox entries;
- 256 durable conflicts and 2,048 fixed-code refresh failures per coordinator.

The initial governed launch remains bounded to at most two companies and 40 named users. The broader 10-workspace, 100-user, and 25-concurrent-reader harness is capacity evidence, not production authorization.

## Cost projection

Pricing basis checked 2026-07-23 against Cloudflare's official Durable Objects pricing:
https://developers.cloudflare.com/durable-objects/platform/pricing/

For the authorized maximum-two-company launch boundary, a conservative 40-user model at 100 availability reads per user per day plus one daily refresh per workspace/profile is about 120,060 Durable Object requests per 30-day month. That is below the Workers Paid allowance of 1 million requests and far below its 400,000 GB-s duration allowance. The runtime also stays below the included 25 billion rows read, 50 million rows written, and 5 GB-month of SQLite storage when both coordinators remain within their 768 MiB application ceilings.

Projected incremental Durable Object cost is therefore USD 0/month on an existing Workers Paid subscription; the account-level Workers minimum remains USD 5/month. At the 10-scope engineering ceiling, fully consuming every 768 MiB coordinator budget would total 7.5 GiB and add about USD 0.50/month of SQLite storage beyond the included 5 GB-month. Provider fees, if a separately approved provider is later activated, are excluded and remain an activation blocker.

## Activation dependencies

Activation requires a separate Founder decision, a production-authorized Data manifest, canonical Administration IDs, authenticated territory assignments, a Data-producer service binding, an approved provider and credential, the daily trigger declaration, monitoring review, and a newly qualified forward-compatible rollback bundle.

No credential, paid provider, Google dependency, scheduled trigger, deployment, production data migration, cache purge, or activation is authorized by this source batch.

## Rollback

Rollback is a forward deployment. It retains the Durable Object export, binding, namespace, additive migration history, and accepted records; forces the runtime OFF; and omits the scheduled trigger. Native rollback and deleted-class migrations are prohibited.
