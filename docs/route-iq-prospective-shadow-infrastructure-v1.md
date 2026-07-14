# Route IQ prospective shadow Infrastructure v1

Batch: `BATCH-20260713-004`

Status: server-side lifecycle implemented and locally verified; collection `OFF`; recommendation influence `OFF`. No push, deploy, or activation was performed.

## Ownership and dependency boundary

Infrastructure wraps Prometheus Data coordinator commits `7970f240`, `968212e`, `ce9f642`, `88b8490`, `89e9ae46`, `9b53a21`, `b7896a6`, and `f4ecc7e`, plus Intelligence runtime commit `4e66667`. It does not alter Data or Intelligence schema/domain behavior and never creates caller-derived canonical identity.

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

The thin repository adapter implements Data's synchronous `executeSchema(sql)`, `execute(sql, bindings)`, and `transactionSync(callback)` shape with `ctx.storage.sql`. Schema initialization is guarded by `blockConcurrencyWhile`.

The DO exposes domain RPCs only: `allocateNextStopOpportunity`, `noteGovernedRepresentativeSignal`, `closeCanonicalSession`, trusted manifest/snapshot/decision adapters, `readCanonicalRuntimeContext`, `recordRuntimeStageExclusion`, `linkServerDerivedNextStopAction`, `reconcileCommittedFieldSessionOutcomes`, `admitIntelligenceScoreableOutcome`, and `admitIntelligenceEvaluation`. There is no generic SQL, KV, storage, or `fetch()` RPC.

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

Infrastructure and Intelligence producer authority envelopes use keyed HMAC-SHA-256 through Web Crypto. The protected key is required at runtime and never appears in source, logs, reports, or documentation. The key version produces a non-secret key identifier. Production timestamps use `Date`; clock and key hooks are explicit noncanonical test inputs.

## Browser and action boundary

The body is limited to 2 KiB and exactly `eventKind`, optional bounded `informationalSequence`, and optional canonical `informationalObservedAt`. The supported kinds are `next_stop_requested`, `representative_action_observed`, and `representative_outcome_observed`.

Callers cannot provide workspace/profile/representative/session/opportunity/candidate IDs, authoritative timestamps, hashes, eligibility, provenance, source manifests, seals, engine/readiness fields, outcome assertions, or recommendation data. Access verification always precedes DO lookup. Stub naming never consumes browser identity, session, opportunity, sequence, or time.

At the explicit `representative_action_observed` next-stop seam, Infrastructure reads Data's canonical runtime context and calls `linkServerDerivedNextStopAction` with only the canonical runtime-context receipt, event kind, and server `Date` time. Data links the unique ordinal-one candidate only after the canonical decision seal; action before seal is a governed exclusion. The browser cannot select a candidate. The response is opaque `202 accepted`, and failure is isolated in `waitUntil`.

`representative_outcome_observed` remains a `governed_noop`; browser outcome assertions are never canonical. No response contains session/opportunity/candidate/shadow/readiness/seal details, and no representative-visible shadow data is stored in browser storage.

## Committed outcome reconciliation

After `/api/dashboard/route-iq/field-session` has successfully persisted its canonical End Route/End Day handoff, Infrastructure schedules one caught prospective task. It reads the exact committed archive from `DATA_ROUTE_IQ_FIELD_SESSION_STORE`, verifies the committed digest, and uses Data `projectCommittedRouteIqFieldSessionOutcomes` to produce the PII-free projection.

Data `reconcileCommittedFieldSessionOutcomes` requires a matching canonical `CLOSED` event. Infrastructure therefore constructs the projection first, HMAC-binds and calls idempotent `closeCanonicalSession`, then HMAC-binds and admits that exact projection through `reconcileCommittedFieldSessionOutcomes`. This owner-contract ordering preserves the archive digest and closure recovery semantics. Success, projection failure, reconciliation rejection, timeout, missing key, missing binding, and `waitUntil` registration failure never replace or delay the original field-session `200`/`201` acknowledgment.

The DO already exposes `admitIntelligenceScoreableOutcome` and `admitIntelligenceEvaluation`, but Infrastructure does not call them yet. Intelligence currently lacks the pure canonical builders needed to derive those claims from admitted committed evidence. The exact Intelligence owner handback is:

- Export `deriveRouteIqScoreableOutcomeFromCommittedEvidence({ projectionOutcome, reconciliationLink })`, accepting exactly one PII-free Data projection outcome and its matching reconciled link, and returning only `{ sourceOutcomeEvidenceSha256, outcomeDerivationContractVersion, observedOutcome: { status, value } }`. Status is `observed` or `missing`, an observed value is boolean, and the digest must equal the admitted link's `evidenceSha256`.
- Export `buildRouteIqEvaluationFromAdmittedOutcome({ projectionOutcome, reconciliationLink, scoreableOutcomeAdmission })`, accepting only those canonical PII-free records and returning `{ sourceOutcomeEvidenceSha256, evaluationRecordSha256, evaluationContractVersion }`, with a deterministic canonical evaluation record bound to the same admitted evidence and scoreable outcome.

Both builders must be pure, versioned Intelligence authority functions with deterministic hashes and tests. Until they exist, the lifecycle stops truthfully after PII-free reconciliation; Infrastructure does not infer success, scoreability, or evaluation.

## Budgets, privacy, and metrics

Controls bound browser/domain-command bytes, each source artifact (4 MiB), aggregate source artifacts (8 MiB), candidate/source counts, SQL statements, rows read/written, opportunities per session, events per UTC day, pending outbox entries, principals/cohorts, and coordinator database size. SQL cursors stop at row budgets and there are no unbounded Infrastructure reads.

Structured metrics contain an allowlisted event kind, outcome, status, error code, phase, and retryability only. They contain no email, JWT, Access subject, internal scope ID, key material, browser content, candidate/recommendation detail, archive content, or shadow payload. This adds no PII category or retention period.

## Cost assumptions

`OFF = $0 incremental`: the fast path performs no JWKS request, Aegis KV call, Durable Object RPC/compute/storage operation, asset read, or added bound-service call. The ordinary private Worker request remains in the existing baseline.

When later enabled, each DO RPC and SQLite operation is billable under the active Cloudflare plan. Current official assumptions are the Workers Paid included allowance followed by Durable Object request/duration charges, plus SQLite rows-read, rows-written, and stored-data charges. Free-plan daily limits also apply. Pricing must be rechecked before activation against [Cloudflare Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/).

API/config choices follow current Cloudflare guidance for [Durable Object RPC](https://developers.cloudflare.com/durable-objects/best-practices/create-durable-object-stubs-and-send-requests/), [SQLite storage](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/), [migrations](https://developers.cloudflare.com/durable-objects/reference/durable-objects-migrations/), [static assets bindings](https://developers.cloudflare.com/workers/static-assets/binding/), [Access JWT validation](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/), [Workers best practices](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/), and [Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/).

## Verification

`npm run infrastructure:route-iq-prospective-shadow:check` runs source/config invariants and 22 Node/real-Miniflare tests. Coverage includes OFF zero-call behavior, Access signature/issuer/audience/expiry, strict territory provenance, Access-before-DO, authority rejection, opaque responses, production per-stage server clock sampling, same-millisecond logical monotonicity, stale/future allocation and client-clock isolation, concurrent allocation through real manifest/snapshot/decision seals, action before/after seal, source failure exclusions, archive projection/reconciliation, unchanged field-session acknowledgments under success/rejection/timeout/missing binding/missing key, HMAC tamper rejection, stable scope routing, cross-scope rejection, blocked generic RPC, and restart persistence.

Release validation also runs Data coordinator/field-session tests, existing Worker tests, Aegis/security checks, lint/typecheck/build, Wrangler 4.110.0 config validation and dry-run, secret scan, and owned-diff checks.

## Rollback

Before any deployment, a forward-revert removes the Infrastructure code, private binding, and unapplied migration entry.

After a future deployment, first set collection to `OFF`. Then forward-revert endpoint/runtime code while retaining the binding, migration, and class until an authorized retirement plan is approved. Never rewrite migration history and never auto-delete data. A later class/namespace retirement requires explicit Founder and governance authorization.
