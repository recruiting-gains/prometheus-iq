# Route IQ prospective shadow Infrastructure v1

Batch: `BATCH-20260713-004`

Status: server-side lifecycle implemented and locally verified from Infrastructure base ancestor `84319f9c70004edd50e1531e48ea1d0d7b501089`; collection `OFF`; recommendation influence `OFF`. No push, deploy, or activation was performed.

## Ownership and dependency boundary

Infrastructure wraps clean main ancestor `84319f9c70004edd50e1531e48ea1d0d7b501089`, Prometheus Data coordinator commits `7970f240`, `968212e`, `ce9f642`, `88b8490`, `89e9ae46`, `9b53a21`, `b7896a6`, `f4ecc7e`, `b388849c21051262e0f80e4c24875147cf9889dd`, and `84319f9c70004edd50e1531e48ea1d0d7b501089`, plus Intelligence runtime commit `4e66667`. It does not alter Data or Intelligence schema/domain behavior and never creates caller-derived canonical identity.

The private endpoint is `/api/dashboard/route-iq/prospective/event`. While collection is `OFF`, it returns a nonblocking disabled acknowledgment before Aegis, Access/JWKS, Durable Object lookup, asset reads, or storage. When a governed cohort is explicitly enabled, `next_stop_requested` first calls Data `allocateNextStopOpportunity({ event })`. Only after that canonical allocation succeeds does Infrastructure return an opaque `202 accepted` response and register a caught server-only lifecycle promise with `executionContext.waitUntil`.

The background lifecycle:

1. Calls Data `readCanonicalRuntimeContext` for the allocated scope and canonical receipt.
2. Reads exactly the active pool, full pool, quarantine pool, and business-hours JSON artifacts through the existing `ASSETS` binding under individual and aggregate byte limits.
3. Uses Intelligence `produceRouteIqNextStopCandidateManifest` and `buildCandidateManifestCoordinatorClaims`, applies a producer-keyed manifest envelope through Data, and does not expose the manifest.
4. Uses Intelligence `buildSnapshotSealCoordinatorClaims` and `createImmutableAcceptedCandidateSnapshot`, then applies the keyed snapshot seal through Data.
5. Uses Intelligence `produceShadowDecisionFromAcceptedSnapshot` and `buildShadowDecisionSealCoordinatorClaims`, then applies the keyed decision seal through Data.

Every lifecycle failure is caught. Infrastructure attempts Data `recordRuntimeStageExclusion` where canonical state permits and emits only structured, non-PII telemetry. No background failure changes the representative acknowledgment.

Every lifecycle timestamp is sampled from production `new Date()` at the stage that records it. The allocation receipt is used only as the required prior canonical boundary; it is never incremented into a fabricated lifecycle timeline. A server-side monotonic sequencer chooses the current sample or, when samples collide in the same millisecond, the immediately following logical millisecond needed for Data's strict ordering. If the allocation receipt is ahead of the first server sample, orchestration fails closed before runtime-context, manifest, or seal RPCs. Stale allocation times and browser informational times cannot set seal chronology. Deterministic clocks are available only under explicitly enabled `noncanonicalTestHooks` and are never production inputs.

## Binding and migration

- Private Worker binding: `ROUTE_IQ_PROSPECTIVE_SHADOW_COORDINATOR`
- Exported SQLite Durable Object class: `RouteIqProspectiveShadowCoordinator`
- Additive migration: `route-iq-prospective-shadow-sqlite-v1` using `new_sqlite_classes`
- Instance boundary: one object per authenticated workspace + operating profile + internal representative
- Stub name: SHA-256 of only the verified internal scope mapping and routing version
- Public Worker: unchanged and unbound

The thin repository adapter implements Data's synchronous `executeSchema(sql)`, `execute(sql, bindings)`, and `transactionSync(callback)` shape with `ctx.storage.sql`. Schema initialization is guarded by `blockConcurrencyWhile`. Infrastructure preflights every schema/execute call before `sql.exec`: reject SQL above `96 KiB` and reject more than `96 bindings`.

The DO exposes domain RPCs only: `allocateNextStopOpportunity`, `noteGovernedRepresentativeSignal`, `closeCanonicalSession`, trusted manifest/snapshot/decision adapters, `readCanonicalRuntimeContext`, `recordRuntimeStageExclusion`, `linkServerDerivedNextStopAction`, `reconcileCommittedFieldSessionOutcomes`, `admitIntelligenceScoreableOutcome`, `admitIntelligenceEvaluation`, `recoverNextProjection`, `readCommittedProjectionAsOf`, and `readCommittedProjectionForOutcomeArtifact`. There is no generic SQL, KV, storage, or `fetch()` RPC.

## Access, scope, and authority

The active endpoint requires `Cf-Access-Jwt-Assertion`. `jose` verifies an RS256 signature against the configured Cloudflare Access JWKS, exact issuer/team domain, application audience, subject, issued-at time, and expiry. Header presence alone is rejected. The verified Access subject is SHA-256 matched to a server-side governed principal map. Raw subject, email, and JWT are never logged or persisted.

Each mapped principal must include an exact `territoryContext` with status `known`, internal territory ID, `sourceRecordSha256`, `sourceContractVersion`, and canonical `availableAt`. `createScopeEnvelope` binds that provenance into every Data coordinator opening. Missing, malformed, stale-shaped, or unmapped territory provenance fails closed before canonical manifest production. No PII is added.

Required runtime setting names, with no values in source control:

- `ROUTE_IQ_PROSPECTIVE_SHADOW_COLLECTION`
- `ROUTE_IQ_PROSPECTIVE_SHADOW_COHORT_CONFIG`
- `ROUTE_IQ_PROSPECTIVE_SHADOW_ACCESS_TEAM_DOMAIN`
- `ROUTE_IQ_PROSPECTIVE_SHADOW_ACCESS_AUDIENCE`
- `ROUTE_IQ_PROSPECTIVE_SHADOW_PRINCIPAL_MAP`
- `ROUTE_IQ_PROSPECTIVE_SHADOW_AUTHORITY_KEY`
- `ROUTE_IQ_PROSPECTIVE_SHADOW_AUTHORITY_KEY_VERSION`

Missing or invalid global activation/cohort configuration is `OFF`. Once globally enabled, missing or invalid Access configuration/token/map, governed territory provenance, authority key/version, binding, or scope fails closed. Collection activation is independent of recommendation influence, which remains `OFF`.

`BATCH-20260714-003` tightens the future cohort contract to `route-iq-prospective-cohort-config-v2`. A valid activation value must be explicitly `ACTIVE`, contain canonical issue/expiry timestamps with a positive lifetime no longer than 24 hours, allow exactly `next_stop`, and contain exactly one governed internal representative scope. Future-issued, expired, multi-scope, unknown-scope, extra-field, unsupported-opportunity, missing, or malformed values remain `OFF`. The source-controlled activation template is `INERT_DEFAULT_OFF`, contains no real cohort identity, and is intentionally invalid for direct production use.

The pure local readiness auditor reports endpoint state, attempted application writes, active cohort count, Durable Object/KV/prospective/conflict/exclusion/evaluation counts, archive-disposition consumer exclusion, and every governed budget. It performs no Cloudflare or storage access and always reports `activationAuthorized: false` and `productionVerified: false`. The authenticated deployment, immediate-disable, separate activation, monitoring, and forward-rollback procedure is documented in `docs/route-iq-prospective-collection-activation-runbook-v1.md`.

Infrastructure and Intelligence producer authority envelopes use keyed HMAC-SHA-256 through Web Crypto. The protected key is required at runtime and never appears in source, logs, reports, or documentation. The key version produces a non-secret key identifier. Production timestamps use `Date`; clock and key hooks are explicit noncanonical test inputs.

## Authenticated read-only bootstrap

`BATCH-20260714-002` adds an Infrastructure-owned bootstrap on `GET /api/dashboard/route-iq/prospective/event`. It does not add an endpoint, service, binding, vendor, storage system, PII category, or production activation.

When collection is `OFF`, missing, or malformed, GET and POST retain the existing opaque `202 disabled` response before Access/JWKS, Aegis KV, Durable Object lookup, assets, or any storage. When collection is `ON`, GET verifies the existing Cloudflare Access JWT and the server-owned principal/cohort mapping. Only an exact governed workspace, operating profile, internal representative, active cohort, and supported `next_stop` opportunity can receive an enabled bootstrap.

The enabled response is `Cache-Control: no-store` and contains only:

- `bootstrapContractVersion = route-iq-prospective-browser-bootstrap-v1`;
- `status = enabled`, `collection = ON`, and `recommendationInfluence = OFF`;
- the authorized internal workspace, operating-profile, and representative IDs;
- `activeCohort = true` and `supportedOpportunityTypes = [next_stop]`;
- the browser-event, runtime-context, and coordinator contract versions;
- authoritative `issuedAt` and `expiresAt` timestamps.

The freshness window is at most 60 seconds and never extends past the verified Access token expiration. Missing, expired, unmapped, cross-cohort, or malformed authentication/configuration cannot produce an enabled response. A consuming Dashboard must require the exact versions, scope, cohort, opportunity type, ON/OFF boundaries, and unexpired timestamps; any absent, unknown, stale, malformed, or mismatched value is disabled.

The GET branch returns before the write-capable path. It verifies that the existing coordinator, protected authority-key configuration, and governed asset binding are available, but never calls the Durable Object binding, creates a stub, reads or writes KV/Data/DO, fetches assets, generates candidates, emits evidence, registers background work, or drains retries/outboxes. It also bypasses the storage-writing Aegis rate-limit operation while retaining the Aegis no-store/security response headers and Cloudflare Access enforcement. Active POST behavior retains its existing Aegis, Access, authority, coordinator, and fail-closed controls.

## Browser and action boundary

The body is limited to 2 KiB and exactly `eventKind`, optional bounded `informationalSequence`, and optional canonical `informationalObservedAt`. The supported kinds are `next_stop_requested`, `representative_action_observed`, and `representative_outcome_observed`.

Callers cannot provide workspace/profile/representative/session/opportunity/candidate IDs, authoritative timestamps, hashes, eligibility, provenance, source manifests, seals, engine/readiness fields, outcome assertions, or recommendation data. Access verification always precedes DO lookup. Stub naming never consumes browser identity, session, opportunity, sequence, or time.

At the explicit `representative_action_observed` next-stop seam, Infrastructure reads Data's canonical runtime context and calls `linkServerDerivedNextStopAction` with only the canonical runtime-context receipt, event kind, and server `Date` time. Data links the unique ordinal-one candidate only after the canonical decision seal; action before seal is a governed exclusion. The browser cannot select a candidate. The response is opaque `202 accepted`, and failure is isolated in `waitUntil`.

`representative_outcome_observed` remains a `governed_noop`; browser outcome assertions are never canonical. No response contains session/opportunity/candidate/shadow/readiness/seal details, and no representative-visible shadow data is stored in browser storage.

## Committed outcome reconciliation

After `/api/dashboard/route-iq/field-session` has successfully persisted its canonical End Route/End Day handoff, Infrastructure schedules one caught prospective task. It reads the exact committed archive from `DATA_ROUTE_IQ_FIELD_SESSION_STORE`, verifies the committed digest, and uses Data `projectCommittedRouteIqFieldSessionOutcomes` to produce the PII-free projection.

Data `reconcileCommittedFieldSessionOutcomes` requires a matching canonical `CLOSED` event. Infrastructure therefore constructs the projection first, HMAC-binds and calls idempotent `closeCanonicalSession`, then HMAC-binds and admits that exact projection through `reconcileCommittedFieldSessionOutcomes`. This owner-contract ordering preserves the archive digest and closure recovery semantics. Success, projection failure, reconciliation rejection, timeout, missing key, missing binding, and `waitUntil` registration failure never replace or delay the original field-session `200`/`201` acknowledgment.

After reconciliation, Infrastructure processes `reconciliationReceipt.linked` in deterministic order, one link at a time, and isolates failures per link so one poisoned record cannot block later outcomes. For each link it:

1. Uses Intelligence `deriveRouteIqScoreableOutcomeFromCommittedEvidence` and `buildRouteIqScoreableOutcomeAdmissionClaims`.
2. Signs producer-channel claims with the existing protected Infrastructure authority key/version and calls DO `admitIntelligenceScoreableOutcome`.
3. Reads the exact committed projection only through DO `readCommittedProjectionForOutcomeArtifact({ scopeEnvelope, input: { authorityEnvelope } })` with producer purpose `committed_outcome_projection_read`, binding only `sourceOutcomeEvidenceSha256` and the exact `outcomeReceipt`.
4. If Data throws `route_iq_coordinator_projection_recovery_pending`, calls DO `recoverNextProjection` one operation at a time and retries the exact read after each recovery.
5. Uses the governed Infrastructure hard bound `pendingOutbox = 128` recoveries. If the exact projection is still pending after that bound, the link fails closed and later links continue.
6. Never reads latest/current runtime context for outcome projection or evaluation.
7. For observed scoreable outcomes only, requires an authenticated Data retention envelope before using Intelligence `buildRouteIqEvaluationFromAdmittedOutcome`, `isRouteIqEvaluationReadinessCountEligible`, and `buildRouteIqEvaluationAdmissionClaims`, then calls DO `admitIntelligenceEvaluation`.

The current production runtime has no authenticated Data retention-envelope producer because the Data policy remains activation-ineligible. Infrastructure therefore never derives a retention boundary from browser input, archive timing, or runtime defaults. Missing authenticated retention input fails the link closed as `route_iq_prospective_retention_input_unavailable`, admits no readiness evaluation, and does not replace or delay the canonical field-session acknowledgment.

Full evaluation compatibility is exercised only through the explicit `buildNoncanonicalAuthenticatedDataRetentionEnvelope` noncanonical test hook. That hook is unavailable in the Worker production call path and may provide fixture-only expiry, legal-hold, deletion-capability, and source-session data solely for local and Miniflare verification. It is not a production retention authorization.

Deterministic retries return existing receipts. Changed-content retries fail closed as durable Data conflicts. A missing/non-scoreable outcome still admits the scoreable outcome record, but skips evaluation admission. Per-link failures emit only redacted Infrastructure telemetry and never alter the Dashboard End Route/End Day acknowledgment.

## Budgets, privacy, and metrics

Controls bound browser/domain-command bytes, each source artifact (4 MiB), aggregate source artifacts (8 MiB), candidate/source counts, SQL statements, rows read/written, opportunities per session, events per UTC day, pending outbox entries, principals/cohorts, and coordinator database size. The governed recovery ceiling is `pendingOutbox = 128`. SQL cursors stop at row budgets and there are no unbounded Infrastructure reads.

Structured metrics contain an allowlisted event kind, outcome, status, error code, phase, and retryability only. They contain no email, JWT, Access subject, internal scope ID, key material, browser content, candidate/recommendation detail, archive content, or shadow payload. This adds no PII category or retention period.

## Cost assumptions

`OFF = $0 incremental`: the fast path performs no JWKS request, Aegis KV call, Durable Object RPC/compute/storage operation, asset read, or added bound-service call. The ordinary private Worker request remains in the existing baseline.

When later enabled, each DO RPC and SQLite operation is billable under the active Cloudflare plan. Current official assumptions are the Workers Paid included allowance followed by Durable Object request/duration charges, plus SQLite rows-read, rows-written, and stored-data charges. Free-plan daily limits also apply. Pricing must be rechecked before activation against [Cloudflare Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/).

API/config choices follow current Cloudflare guidance for [Durable Object RPC](https://developers.cloudflare.com/durable-objects/best-practices/create-durable-object-stubs-and-send-requests/), [SQLite storage](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/), [migrations](https://developers.cloudflare.com/durable-objects/reference/durable-objects-migrations/), [static assets bindings](https://developers.cloudflare.com/workers/static-assets/binding/), [Access JWT validation](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/), [Workers best practices](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/), and [Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/).

## Verification

`npm run infrastructure:route-iq-prospective-shadow:check` runs source/config invariants and focused Node/real-Miniflare tests. Coverage includes OFF zero-call behavior, Access signature/issuer/audience/expiry, strict territory provenance, Access-before-DO, authority rejection, opaque responses, production per-stage server clock sampling, same-millisecond logical monotonicity, stale/future allocation and client-clock isolation, concurrent allocation through real manifest/snapshot/decision seals, action before/after seal, source failure exclusions, archive projection/reconciliation, exact producer-only committed projection read/recovery, valid noncanonical retention-envelope outcome admission, production missing-retention fail-closed behavior, missing/non-scoreable skip, retry/restart, projection interruption and late retry, durable conflict isolation, 128-recovery success and governed exhaustion failure, two-opportunity same-session restart coverage, unchanged field-session acknowledgments under success/rejection/timeout/missing binding/missing key, HMAC tamper rejection, stable scope routing, cross-scope rejection, blocked generic RPC, and restart persistence.

Release validation also runs Data coordinator/field-session tests, existing Worker tests, Aegis/security checks, lint/typecheck/build, Wrangler 4.110.0 config validation and dry-run, secret scan, and owned-diff checks.

## Rollback

Before any deployment, a forward-revert removes the Infrastructure code, private binding, and unapplied migration entry.

After a future deployment, first set collection to `OFF`. Then forward-revert endpoint/runtime code while retaining the binding, migration, and class until an authorized retirement plan is approved. Never rewrite migration history and never auto-delete data. A later class/namespace retirement requires explicit Founder and governance authorization.
