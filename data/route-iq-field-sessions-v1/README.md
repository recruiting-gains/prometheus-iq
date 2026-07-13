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

`route-iq-prospective-shadow-evidence.mjs` defines the dormant Data implementation for prospective `next_stop` decision opportunities. The versioned capture schema is `route-iq-prospective-opportunity-snapshot-v1.schema.json`. It uses the existing `DATA_ROUTE_IQ_FIELD_SESSION_STORE` adapter and writes beneath the existing session keyspace:

`route-iq-field-sessions/v1/workspaces/{workspaceId}/sessions/{fieldSessionId}/prospective-shadow-evidence/v1/opportunities/{opportunityId}`

Infrastructure-facing interfaces are `createRouteIqProspectiveServerContext`, `captureRouteIqProspectiveOpportunitySnapshot`, `appendRouteIqProspectiveAction`, `appendRouteIqProspectiveOutcome`, `appendRouteIqProspectiveCorrection`, and `appendRouteIqProspectiveGovernedExclusion`. Intelligence-facing interfaces are `validateRouteIqProspectiveSealReceipt`, `readRouteIqProspectiveLifecycle`, and the existing `projectRouteIqChronologicalEvidence` with an optional verified `prospectiveLifecycleRecord`. These are contract surfaces only. No Worker, Dashboard, route flow, endpoint, queue, binding, or production consumer invokes them in this Data commit.

The snapshot capture request requires an opaque opportunity ID and idempotency key, the Fitness Connection workspace/profile, a registered internal representative, a field-session ID, `next_stop`, a complete candidate set, a complete source manifest, candidate eligibility metadata, territory/time/permitted-representative context, schema/capture/source versions, and informational client sequence/time. Data supplies the authoritative server timestamp, evidence cutoff, candidate-set digest, artifact digest, commit digest, and chronological Data projection version. Data canonicalizes candidate, source, and reason-code ordering before hashing. It does not accept client-supplied authoritative timestamps, hashes, seal/readiness/engine/model values, rankings, scores, or probabilities.

Every accepted snapshot, action, outcome, correction, exclusion, and conflict is immutable and committed last under a stable append-only key. Identical idempotent replay returns the originally committed artifact. Reuse of the same idempotency key for different canonical content appends a conflict and rejects the incoming content without overwriting the original. Uncommitted partial artifacts remain unreadable; an identical retry can finish the commit after readback verification. Corrupt partial bytes produce a permanent poison-record exclusion and are never overwritten.

An action is admissible only when it is strictly after both the accepted snapshot and a matching Intelligence seal receipt supplied through opaque trusted server context. Actions before or equal to the snapshot, after the snapshot but before or equal to a later seal, missing/tampered receipts, offline or late synchronization, changed/missing candidate context, reused record identities, and invalid chronology become permanent governed exclusions. Each opportunity has one action root and each action has one outcome root. Outcomes must be strictly after their immutable action and retain the same frozen candidate context. Corrections form a strictly chronological, non-forking append-only chain and preserve every prior record. Excluded evidence cannot be corrected or promoted later. Synthetic, test, demo, fixture, historical, and backfill origins never create accepted canonical records.

Decision Source is optional only on an action. Data stores only its canonical source ID plus the authoritative post-action capture time. It is explicitly marked as unable to prove sealing, non-scoreable, and ineligible for sample support. Snapshot requests reject Decision Source entirely.

### Privacy and retention comparison

The recursive allowlist rejects unknown fields. PII/contact data, names, raw or free-form notes, comments, audio/recordings/transcripts, addresses, coordinates, latitude/longitude, precise location, cross-workspace/account/tenant fields, and cross-representative actor fields are not stored. A privacy rejection may persist only a sanitized exclusion code, allowlisted scope/opaque IDs, and offending field paths; rejected values are never copied into the store.

| Field category | Existing field-session archive | Prospective v1 | Retention effect |
| --- | --- | --- | --- |
| Workspace/profile/internal representative/session IDs | Already stored | Required, scope-checked | No new identity class; existing internal scope only |
| Opaque opportunity/idempotency/record IDs | Not present | Added as non-PII lifecycle keys | Stored under the existing field-session store policy; no new retention period |
| Candidate IDs and source record IDs | Governed business/source identities already used by Route IQ | Complete frozen opaque set | No business names, contacts, addresses, or precise location added |
| Territory and time context | Territory may be present; timestamps already stored | Territory ID, timezone, window ID, local date | Coarse governed context only; no coordinates or location expansion |
| Eligibility metadata | Existing governed eligibility sources | Status, reason codes, evaluated time | Structured source metadata only; no score, rank, probability, or readiness |
| Client sequence/time | Visit/report times already stored | Informational sequence, observed time, sync mode | Not authoritative and does not expand retention duration |
| Server chronology and digests | Commit time and source hashes already stored | Snapshot/action/outcome/correction times and content/commit hashes | Integrity metadata under the existing policy; no new retention period |
| Decision Source | Optional post-action visit context | Optional action-only source ID | No notes/evidence text; cannot seal, score, or support a sample |
| PII, contacts, raw notes, audio, precise location | Not authorized for this Data spine | Explicitly prohibited | No new PII collection and no retention expansion |

No retention duration is introduced or extended by this lifecycle. Infrastructure must use the existing store policy if later activation is separately authorized. Data owns validation, normalization, append-only persistence, integrity, scope/privacy enforcement, and chronological projection. Intelligence owns sealing, ranking, probability, evaluation, and readiness. Infrastructure and Dashboard own any later trusted runtime capture wiring. Overwatch owns authorization and verification. Recommendation influence remains off.

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
