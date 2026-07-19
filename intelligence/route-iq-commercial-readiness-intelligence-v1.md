# Route IQ Commercial Readiness Intelligence v1

This Intelligence-owned projection turns governed Route IQ evidence into a deterministic daily Founder snapshot. It is a read-only reporting boundary, not a recommendation system, route consumer, source database, or representative feature.

## Data input boundary

The engine accepts a server-supplied `route-iq-business-intelligence-context-v1` object owned by Prometheus Data. The object binds the workspace, operating profile, configuration version, retention policy, evidence classification, and canonical configuration hash. Caller-supplied context fails closed.

Fitness Connection evidence is accepted only when Data classifies it as `FOUNDER_FIELD_RESEARCH`. No Data artifact path is pinned here because the commercial workspace configuration is being established by its owner. Once available, that canonical Data configuration can satisfy the existing input contract without an Intelligence or business-specific fork.

The daily evidence projection is summary-level. It accepts opaque identities, timestamps, source hashes, quality and freshness states, version provenance, and governed aggregate metrics. It rejects raw notes, names, business names, addresses, contact information, precise coordinates, secrets, excluded evidence, and cross-scope records.

## Determinism

Records are normalized and sorted by timestamp, kind, and opaque identity. Object keys are canonicalized before SHA-256 hashing. Snapshot time and date derive only from the latest governed evidence timestamp; no wall clock is read. The learning assessment is hash-bound to the normalized evidence. Reordered inputs produce the same artifact, and unchanged governed input returns the prior snapshot byte-equivalent.

The snapshot reports evidence counts, intrinsic freshness, data quality, daily visit and outcome trends, learning coverage, confidence or insufficiency, and changes from a prior governed snapshot. Insufficiency is explicitly not a recommendation or prediction.

## Access and safety

Access requires an authenticated, server-derived, immutable principal mapping. Prometheus Data's `data/route-iq-commercial-readiness-v1/route-iq-commercial-workspace-registry-v1.json` is the canonical identity registry, and Intelligence requires exact cross-consumer equality with Cruz's governed `riq_principal_7250bf2f7db15371eea3173c4f25953cffd6adf5b29f093ce8f9f0977a70e3c4` identity. The current allowlist contains only mapping `route-iq-founder-access-cruz-v1`. Display names and representative roles cannot authorize access. Anthony remains denied until a separately secured authenticated identity mapping exists in that Data registry.

Discovery Mode and Nearby Context remain advisory. Off-route learning remains read-only observation. Route ordering, route scoring, representative workflows, source evidence, and recommendation influence are unchanged. Recommendation influence remains `OFF`.
