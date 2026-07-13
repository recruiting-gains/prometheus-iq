# Decision Context Cumulative Validation v1

Batch: `BATCH-20260713-002`

Owner: Prometheus Data

Frozen base: `18ed83effdca1219729e4e71f452eeea8c3b273b`

Revalidated lineage:

- `fc8f9c6a8acf04a80e4d5f93485225dfefea9407` - canonical decision-context preservation
- `232e192a9fa5a14641d411896d43a0495a46ae01` - decision-context validation hardening
- `13c0bbfb72b72e1b492369fdfe896fffbddefaa6` - final recommendation-ID validation repair

## Contract-mismatch closure

The previously reported release failure was a stale shared Dashboard source-hash assertion, not a Data normalization failure. At the frozen base, both `npm run overwatch:artifact-contracts:check` and `npm run test:overwatch` pass. Data did not edit the Overwatch-owned Dashboard consumer contract in this revalidation.

## Cumulative findings

- New completed visits require non-null `visitDecisionSource` and `recommendationDecisionContext` fields.
- Missing fields, null fields, unsupported sources, malformed evidence, whitespace-only IDs, and contradictory recommendation states fail before archival.
- Explicit `unknown` remains canonical with confidence `0` and reason `null`; missing input is not inferred as unknown.
- Recommendation IDs are trimmed. Available recommendations require a canonical ID; unavailable recommendations require a null ID.
- Decision Source is captured with visit completion. Its timestamp is canonical UTC and must equal the completed visit timestamp.
- Decision Source is post-action observational context. It is not a pre-action candidate snapshot and contains no frozen candidate set, rankings, probabilities, eligibility state, or immutable source manifest.
- Chronological projection excludes Decision Source at its visit timestamp and includes it only for later cutoffs. Strict-before cutoff behavior remains intact.
- The raw report is written first and the commit marker last. Identical replay is idempotent; conflicting raw evidence is rejected without overwrite.
- Missing bindings, unknown workspaces, protected workspaces, and cross-representative evidence fail closed.
- The exact July 11 archive remains read-compatible without granting an exemption to new normalization.
- No historical replay, rewrite, backfill, scoring change, route-generation change, recommendation influence, or production consumer is introduced.

## Immutable July 11 evidence

| Artifact | SHA-256 |
| --- | --- |
| Raw export | `a62ec0643d61c8280e0e23dcd8616894a30a421dc9150281fb7cad334f5c0e6a` |
| Normalized field session | `b162ba286debf97461e2f2e172377ed00b07c6c755cd152678e7a944dbccafc8` |
| Calculated metrics | `71171b79aa725e533113f5cc1d040b13f6fc5cb3b5b4cdee993e8d4b836de911` |
| History updates | `0d3f2508b92290b04a1d7b1cc979ee298eea97c9dda84061dbe66e2bea5b5c09` |
| Stress-test observations | `6030bd109659140b00c012fbf09e6a05d63c23f197a58daec8bc63dd2603179e` |
| Manifest | `e0bc2cc65e1c67fb39784c3a1fe87732875b64b6f5f2365df1924da5083265ba` |

These hashes are pinned by Data regression coverage and must remain unchanged.
