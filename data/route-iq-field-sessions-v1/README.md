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

Decision Source is captured atomically with the completed visit. New normalization canonicalizes `capturedAt` to UTC and requires it to equal the visit timestamp. Earlier or later values fail closed. This makes Decision Source post-action observational context: it may describe the representative's reported source after the visit is logged, but it is not timestamp-frozen pre-action candidate evidence and does not preserve the candidate set, ranking, probabilities, eligibility state, or source manifest required by the shadow-decision contract.

The immutable July 11 archive remains available through an exact session-ID and raw-hash read compatibility rule. That exception cannot be used for new normalization and does not rewrite existing evidence, authorize historical replay, influence recommendations, or modify route scoring or generation.

The cumulative owner revalidation for `fc8f9c6`, `232e192`, and `13c0bbf` is recorded in `DECISION_CONTEXT_CUMULATIVE_VALIDATION_V1.md`.

## Chronological shadow-validation evidence

`projectRouteIqChronologicalEvidence` is a read-only, deterministic projection of a committed archive read. It returns only evidence whose canonical UTC timestamp is strictly earlier than the supplied decision timestamp. Evidence exactly at the decision boundary is explicitly excluded unless a future source contract separately proves prior availability. Every included item carries its source record ID, archive and projection versions, exact committed-artifact hashes, session provenance, and explicit workspace, profile, representative, territory, and customer fields (using `null` when unavailable).

Original visit outcomes and any later outcome observations remain distinct records. Governed relations are limited to original, correction, conflict, and late; non-original relations identify a non-empty, non-self source record that must exist in the complete candidate set, but never replace it. The referenced record may sit outside the projection cutoff. Missing timestamps, evidence at the unproven decision boundary, and evidence after the cutoff are explicitly excluded; non-round-tripping calendar timestamps, uncommitted or mismatched commit markers, invalid scope, duplicate source IDs, malformed or dangling relations, cross-representative contamination, and source-byte/hash mismatches fail closed. Candidate scope is validated before unsupported kinds are reported as exclusions. The projection is deeply immutable and its stable SHA-256 makes repeated reads comparable.

This interface supplies evidence only. It does not create recommendations, calculate readiness, replay or backfill sessions, call Google, mutate scoring, or authorize production learning. The July 11 artifacts are unchanged and legitimately contain timestamp-related exclusions.

## Governance

- Workspace: `fitness_connection`
- Operating profile: `fitness`
- Protected workspace: `smoothie_depot`
- Invention classification: operational improvement
- Dashboard behavior changed: no
- Intelligence scoring or recommendations changed: no
- Production Intelligence learning authorized: no
