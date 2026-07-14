# Route IQ Field Sessions v1

Prometheus Data owns this append-only archive for completed Route IQ field sessions. Raw exports, normalized verified records, calculated metrics, history updates, and stress-test observations remain separate so missing evidence never becomes an inferred fact.

## July 11 Founder session

- Final source export: `prometheus-iq-cruz-daily-report-2026-07-11.json`
- Source export time: `2026-07-12T00:25:44.676Z` (`2026-07-11 19:25:44` America/Chicago)
- Canonical session ID: `route-iq-field-session-fitness-connection-fitness-cruz-2026-07-11`
- Raw SHA-256: `a62ec0643d61c8280e0e23dcd8616894a30a421dc9150281fb7cad334f5c0e6a`
- Verified export totals: 4 visits, 4 conversations, 3 leads, 0 units, 0 later units

The raw JSON is copied byte-for-byte and must never be overwritten. The normalized record preserves the export's `Membership` outcome label for Texans Auto Repair while retaining the exported numeric unit count of zero. It does not infer a membership from that label.

The final export does not contain session start/end markers, an initial route, a complete recommendation history, recommendation scores or explanations, replenishment events, replacement recommendations, duplicate-prevention events, completed-stop exclusions, recommendation pool source, structured objections, structured follow-up requirements, territory identity, travel metrics, observation timestamps, or screenshots. Those fields remain unavailable.

## Automatic handoff

`route-iq-end-of-day-data-handoff-v1` is defined in the existing Fitness Connection Data runtime contract. A future Dashboard `End Route` or `End Day` action may submit final raw report bytes through that contract. Dashboard must retain the manual `Export Today's Report` backup and may not write Data artifacts directly.

The Data persistence adapter requires `DATA_ROUTE_IQ_FIELD_SESSION_STORE` with Cloudflare Workers KV `get`, `put`, and `list` methods. Missing or malformed bindings fail before writes. Identical re-ingestion is idempotent; the same deterministic session ID with different raw evidence is rejected. The raw record is written first and a commit marker last, so incomplete writes are not readable as committed sessions.

The repository does not provision or route this binding. Infrastructure must provision it after Overwatch verifies the Data contract. Dashboard trigger work and Intelligence learning consumption require separate subsystem handoffs.

## Decision context

For newly normalized field sessions, each canonical `verifiedFields.completedVisits[]` record requires both `visitDecisionSource` and `recommendationDecisionContext`. Missing or null fields fail closed. Canonical decision sources are Route IQ Recommendation, Nearby Context, Representative Saved Place, Representative Discovery, Representative Follow-up, Existing Relationship, Manual Selection, and Unknown. Explicit Unknown remains Unknown with confidence `0` and reason `null`; it is never inferred from missing input.

Recommendation IDs are trimmed before validation. `recommendationAvailable: true` requires a non-empty canonical ID, while `false` or `null` requires a null ID. Whitespace-only recommendation IDs and decision evidence fail validation before normalization; accepted and overridden decisions always require the canonical ID.

Decision Source is post-action observational context. Known sources and contemporaneous Unknown values require `visitDecisionSource.capturedAt` to resolve to the same canonical UTC instant as the visit timestamp and receive `temporalClassification: action_time_observation`. A legacy active-session visit that lacks context may receive a report-only Unknown fallback at finalization. Data accepts that fallback only when it has zero confidence, no evidence, no recommendation decision, a timestamp strictly after the visit, and `capturedAt` exactly equal to `report.generatedAt`; Data classifies it as `late_report_finalization_unknown`. Backdated, intermediate, or post-finalization timestamps fail closed.

Neither capture mode is a frozen pre-action candidate list, and neither contains ranked candidates, probabilities, an evidence cutoff, or a model/rule version. At its actual capture timestamp, chronological projection excludes the Decision Source. It becomes eligible only for a strictly later decision cutoff, so a late Unknown cannot satisfy the original visit's decision opportunity or retroactively change what was knowable then.

The immutable July 11 archive remains available through an exact session-ID and raw-hash read compatibility rule. That exception cannot be used for new normalization and does not rewrite existing evidence, authorize historical replay, influence recommendations, or modify route scoring or generation.

## Chronological shadow-validation evidence

`projectRouteIqChronologicalEvidence` is a read-only, deterministic projection of a committed archive read. It returns only evidence whose canonical UTC timestamp is strictly earlier than the supplied decision timestamp. Evidence exactly at the decision boundary is explicitly excluded unless a future source contract separately proves prior availability. Every included item carries its source record ID, archive and projection versions, exact committed-artifact hashes, session provenance, and explicit workspace, profile, representative, territory, and customer fields (using `null` when unavailable).

Original visit outcomes and any later outcome observations remain distinct records. Governed relations are limited to original, correction, conflict, and late; non-original relations identify a non-empty, non-self source record that must exist in the complete candidate set, but never replace it. The referenced record may sit outside the projection cutoff. Missing timestamps, evidence at the unproven decision boundary, and evidence after the cutoff are explicitly excluded; non-round-tripping calendar timestamps, uncommitted or mismatched commit markers, invalid scope, duplicate source IDs, malformed or dangling relations, cross-representative contamination, and source-byte/hash mismatches fail closed. Candidate scope is validated before unsupported kinds are reported as exclusions. The projection is deeply immutable and its stable SHA-256 makes repeated reads comparable.

This interface supplies evidence only. It does not create recommendations, calculate readiness, replay or backfill sessions, call Google, mutate scoring, or authorize production learning. The July 11 artifacts are unchanged and legitimately contain timestamp-related exclusions.

## Prospective shadow evidence lifecycle

`route-iq-prospective-shadow-coordinator.mjs` supersedes the prospective admission behavior introduced in `7970f240`. The old `route-iq-prospective-shadow-evidence.mjs` and its `DATA_ROUTE_IQ_FIELD_SESSION_STORE` keys remain readable only as `non_authoritative_cache_only`. Workers KV cannot admit evidence, resolve exclusions or conflicts, establish seals or links, or supply readiness evidence. `projectRouteIqChronologicalEvidence` rejects a KV lifecycle record and accepts only a hash-verified SQLite coordinator projection with a commit-last marker.

The authoritative Data core is storage-neutral but shaped for a SQLite-backed Cloudflare Durable Object. Infrastructure supplies a thin adapter with synchronous `executeSchema(sql)`, `execute(sql, bindings)`, and `transactionSync(callback)` methods. The Data module exports the idempotent DDL through `routeIqProspectiveCoordinatorSchemaSql`, initializes it through `initializeRouteIqProspectiveCoordinatorSchema`, and opens an authenticated scope with `openRouteIqProspectiveCoordinator`. The source-controlled Infrastructure adapter, binding, and additive migration exist in commit `628d846`, but they are not deployed and the collection switch remains off.

The coordinator atom is the authenticated Fitness Connection workspace, operating profile, and registered internal representative. Infrastructure verifies the keyed scope envelope before Data derives `riq_coord_<sha256>`. The narrow allocator accepts only that opened server scope and an informational browser event containing `eventKind`, optional `informationalSequence`, and optional `informationalObservedAt`. Caller routing IDs, session IDs, opportunity IDs, idempotency keys, record IDs, authoritative timestamps, hashes, eligibility, completeness, and receipt fields are rejected. Data atomically opens or reuses one canonical session and one pending `next_stop` opportunity from coordinator state, deriving `riq_session_<sha256>`, `riq_opportunity_<sha256>`, `riq_idempotency_<sha256>`, and artifact IDs without using informational browser metadata as identity. The session and opportunity rows carry the exact server-derived `canonicalSessionRecordSha256` under a composite foreign key, and every later transition, producer envelope, and projection read must match it. Territory comes only from an optional signed server context containing an opaque ID, source-record hash, and contract version. If that context is unavailable, Data stores one explicit nonsemantic unknown sentinel; it does not infer territory from workspace, profile, or representative, and candidate-manifest admission fails closed with `territory_context_unavailable`. Territory, candidate, and source identifiers use approved full-digest formats, so names, addresses, contacts, precise locations, and semantic labels cannot enter identifier fields.

`allocateNextStopOpportunity({ event })` returns the original receipt for concurrent calls, retries, restarts, and rotated informational client sequence/time while the canonical opportunity remains open. A premature action, malformed manifest, incomplete provenance, unknown territory, or ordinary governance failure excludes the opportunity permanently, and a later browser retry cannot rehabilitate or duplicate it. A new opportunity is allocated only after `ACTION_LINKED` or a later trusted lifecycle state, a trusted session close, or the narrow material-manifest exception. That exception requires the latest exclusion to contain exactly `candidate_manifest_materially_changed` from an authenticated, fully validated Intelligence producer and requires the prior complete manifest bytes/hash to remain verified and immutable. The changed manifest never rewrites or replaces the accepted snapshot; Data preserves the prior manifest and allocates a new pending opportunity on the next supported signal. At allocation time candidate completeness is explicitly `pending_authenticated_intelligence_manifest`, `snapshotAccepted` is false, and no record is readiness eligible.

The retained authenticated `trigger()` path remains readable for compatibility. If it created exactly one unclosed session and opportunity before allocator integration, the allocator adopts that identity atomically by appending a standardized, non-rewriting `server_allocate_next_stop` receipt that references the immutable trigger artifact and exposes the same canonical context. It does not create another session, opportunity, or lifecycle event. Multiple unclosed sessions fail closed, and the retained trigger path cannot create a second session while another is open. Allocator timestamps advance beyond the maximum authoritative time across all canonical append-only coordinator records, not merely the record with the latest sequence, so activity on another opportunity cannot backdate a later allocation.

`closeCanonicalSession` is a separate keyed server operation limited to governed `end_route` and `end_day` boundaries. It must bind the canonical `route-iq-end-of-day-data-handoff-v1` digest. In one transaction it excludes any still-open opportunity before appending the immutable session-close event, preserves prior evidence, returns the original receipt on retry even when server time is refreshed, and causes the next supported signal to create a new isolated session. The browser cannot supply a canonical session ID, handoff digest, or close timestamp.

Infrastructure owns the production clock and cryptographic key boundary. Its verifier must return an authenticated `infrastructure_keyed_attestation` or `infrastructure_verified_producer_signature` using HMAC-SHA-256 or Ed25519 plus a canonical key ID. An unkeyed digest, missing signature, changed claim, arbitrary exported timestamp factory, or client-supplied authority field fails closed. Test fixtures use an in-test HMAC verifier and fixed clock only; they are not runtime hooks or canonical evidence.

The `next_stop` candidate manifest is accepted only from a keyed, canonical Prometheus Intelligence producer envelope. It binds producer envelope/contract/schema/Data-projection versions, evidence cutoff, Infrastructure-attested expected candidate/source counts and complete-manifest digest, canonical candidate IDs, canonical source IDs and record hashes, source schema/version, strictly prior availability and eligibility times, complete source references, and contiguous producer ranking ordinals. Optional probability is stored only as signed Intelligence context. Data recalculates no rank, probability, readiness, or recommendation.

### Transaction and state design

SQLite uniqueness constraints serialize canonical sessions, opportunities, operation receipts, attempts, candidate manifests, record sequences, source artifacts, outbox instructions, projections, and commit markers. Append-only triggers reject updates or deletes to immutable tables. One artifact registry enforces ID uniqueness across every artifact kind.

The authoritative state path is:

`TRIGGERED -> EXCLUDED | SNAPSHOT_PENDING_SEAL -> SNAPSHOT_SEALED -> SHADOW_DECISION_SEALED -> ACTION_LINKED -> OUTCOME_LINKED -> EVALUATED`

Each operation transaction stores the canonical attempt, immutable lifecycle event, state transition, monotonic per-coordinator record sequence, operation receipt, and projection-outbox instruction before acknowledgement. Logical idempotency identity consists of the coordinator/opportunity, operation purpose, canonical event boundary, client event sequence/content digest, canonical server/producer content, and keyed authority provenance. `authoritativeRecordTime` is stored separately on the attempt/event/receipt and is deliberately excluded from the logical request digest; a retry with the same logical content and a later re-attested server time returns the exact original receipt and preserves its original time. Changed logical content on the original operation boundary inserts the competing attempt, appends a deterministic conflict, preserves the original, and permanently excludes the opportunity. The competing attempt retains its Infrastructure-attested incoming time as informational conflict input. When that time is not later than the prior canonical record, the conflict lifecycle record alone receives the coordinator-owned next representable millisecond (`prior last_record_time + 1 ms`), giving governance evidence a deterministic, bounded, canonical UTC time without changing or admitting the competing operation. Because callers provide no lifecycle IDs and transaction-local state checks operate with SQLite uniqueness constraints, rotating IDs cannot create a second opportunity, action, outcome, or repaired exclusion.

Snapshot and shadow-decision seals must be independently verified keyed envelopes bound to the prior artifact hash, complete candidate manifest, event boundary, and authoritative time. Action, outcome, evaluation, correction, exclusion, and conflict records are append-only and their canonical lifecycle record times are strictly chronological. Canonical operational transitions, including snapshot acceptance, seals, actions, outcomes, evaluations, and corrections, require an Infrastructure-attested time strictly later than the opportunity's prior `last_record_time`; ordinary exclusions enforce the same rule. Equality or regression fails closed without backdating or admitting operational evidence. A changed idempotent retry is the narrow governance exception described above: its conflict event uses the later attested time or, when necessary, the coordinator-derived prior time plus exactly one millisecond, while preserving the incoming time only as non-evidence metadata. The SQLite opportunity trigger still rejects every non-increasing canonical lifecycle record time. Server-attested uncertain chronology with a later record time remains a permanent governed exclusion. Decision Source may appear only in the verified action record and is marked post-action, non-sealing, non-scoreable, and ineligible for sample support.

Every lifecycle event creates an immutable outbox instruction in the same transaction. `recoverNextProjection` deterministically rebuilds an as-of projection, writes the projection artifact, and writes its commit marker last. A crash at any SQL mutation rolls back the entire transaction; the prior outbox remains recoverable. `readCommittedProjectionAsOf` derives the opportunity from authenticated server identity claims and returns only a committed projection at or before both the authoritative sequence and time. Sequence and time must identify the same canonical history prefix: a pair that includes an event by sequence but excludes it by time, or vice versa, fails closed. Reads also fail while any outbox inside the requested boundary is pending, preventing an older eligible projection from masking a later canonical exclusion or conflict. Later exclusions, conflicts, and corrections cannot appear in an earlier projection. State before `SHADOW_DECISION_SEALED`, or any governed exclusion/conflict, carries no readiness evidence.

Synthetic, test, demo, fixture, replay, historical, and backfill origins transition to a permanent noncanonical exclusion and never enter prospective evaluation. July 11 session artifacts and the historical field-session archive design remain unchanged.

### Privacy and retention comparison

The recursive allowlist rejects unknown fields. PII/contact data, names, raw or free-form notes, comments, audio/recordings/transcripts, addresses, coordinates, latitude/longitude, precise location, cross-workspace/account/tenant fields, and cross-representative actor fields are not stored. A privacy rejection persists only a sanitized reason, trusted boundary hashes, record sequence/content lineage, and offending field paths; rejected values are never copied into SQLite or the KV cache.

| Field category | Existing field-session archive | Prospective v1 | Retention effect |
| --- | --- | --- | --- |
| Workspace/profile/internal representative/session IDs | Already stored | Required, scope-checked | No new identity class; existing internal scope only |
| Opaque opportunity/idempotency/record IDs | Not present | Data-derived full SHA-256 identifiers | No caller semantic IDs and no new retention period |
| Candidate IDs and source record IDs | Governed Route IQ identities | Producer-signed full-digest IDs and provenance hashes | No business names, contacts, addresses, or precise location added |
| Territory and time context | Territory may be present; timestamps already stored | Authenticated coordinator scope and authoritative record time | No coordinates or location expansion |
| Eligibility/ranking metadata | Existing governed eligibility sources | Status, reasons, evaluated time, producer rank/probability context | Data does not calculate or use rank/probability/readiness |
| Client sequence/content lineage | Visit/report times already stored | Server-attested sequence and content digest | No raw client content and no retention expansion |
| Server chronology and digests | Commit time and source hashes already stored | Monotonic sequence, record time, keyed seals, artifact/projection hashes | Integrity metadata only; no new retention period |
| Decision Source | Optional post-action visit context | Optional action-only source ID | No notes/evidence text; cannot seal, score, or support a sample |
| PII, contacts, raw notes, audio, precise location | Not authorized for this Data spine | Explicitly prohibited | No new PII collection and no retention expansion |

No retention duration is introduced or extended by this lifecycle. The Durable Object storage policy and production key configuration remain Infrastructure/Overwatch dependencies before any activation. Data owns schema, validation, deterministic identities, transactional transitions, append-only history, integrity, scope/privacy enforcement, outbox instructions, and chronological projection. Intelligence owns the candidate producer contract, ranking/probability context, shadow decisions, evaluation, and readiness interpretation. Infrastructure owns keyed verification, the production clock, the thin SQLite Durable Object adapter, routing, and runtime wiring. Dashboard owns any later collection activation. Recommendation influence and collection remain off.

## BATCH-20260713-002 owner revalidation

Prometheus Data revalidated the cumulative canonical state introduced by `fc8f9c6a8acf04a80e4d5f93485225dfefea9407`, `232e192a9fa5a14641d411896d43a0495a46ae01`, and `13c0bbfb72b72e1b492369fdfe896fffbddefaa6` against frozen integrated base `18ed83effdca1219729e4e71f452eeea8c3b273b`. The previously reported cross-subsystem contract mismatch is closed in that integrated tree: canonical artifact-contract validation passes without modifying an Overwatch-owned contract.

The revalidation preserves the July 11 raw and normalized archive bytes, the exact-hash legacy read exception, append-only retry/replay behavior, workspace and representative isolation, and strict chronological projection. It adds the prospective timestamp rules above so known context cannot be shifted and a legacy Unknown remains attributable to its truthful later finalization time rather than being backdated.

## Governance

- Workspace: `fitness_connection`
- Operating profile: `fitness`
- Protected workspace: `smoothie_depot`
- Invention classification: operational improvement
- Dashboard behavior changed: no
- Intelligence scoring or recommendations changed: no
- Production Intelligence learning authorized: no
