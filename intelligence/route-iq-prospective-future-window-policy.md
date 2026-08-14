# Route IQ prospective future-window policy

`BATCH-20260814-001` adds a source-only Intelligence policy for replacing the
expired July window schedule without changing the historical July file. The
policy does not activate collection, evaluation, recommendation influence, a
production consumer, or a deployment.

## Integration API

Import `createRouteIqProspectiveFutureWindowAssignment` from
`intelligence/route-iq-prospective-future-window-policy.mjs` and call it with
only an opaque `authorityEnvelope` and, on retry, the previously persisted
`priorAssignment`. Supply a server-owned `authorityVerifier.verify` adapter and
the same internally sampled `serverNow` as the second argument. The adapter
must return admitted keyed authority evidence
using the exact contract in
`intelligence/contracts/route-iq-prospective-future-window-policy-v1.json`.
The request caller cannot provide an anchor, clock, policy, windows, or
readiness configuration. `serverNow` is an Infrastructure-only option, not a
request field. The signed anchor must equal the admission issue time, and the
authority is rejected at its exclusive expiry boundary or after five minutes.

The returned `readinessConfig` is compatible with the existing shadow
readiness functions. It preserves every historical field except `batchId`,
`configVersion`, and `windows`. The training window starts exactly at the
admitted authoritative server anchor. Historical window kinds and durations
are shifted forward from that anchor, producing one training window followed
without gaps by two end-exclusive evaluation windows.

The result is deeply frozen. `assignmentSha256` binds the exact admitted
authority evidence and receipt, source policy bytes, historical July bytes,
generated readiness config, and window list. Persist `assignmentId` under a
unique compare-and-append constraint and always return the persisted value as
`priorAssignment`; a different valid assignment is rejected as retroactive
reassignment. This module intentionally owns no persistence.

Use `serializeRouteIqProspectiveFutureWindowAssignment` for canonical UTF-8
JSON with lexicographically ordered object keys and one trailing line feed.
Use `validateRouteIqProspectiveFutureWindowAssignment` on persisted source
artifacts before integration. Cryptographic authority must still be re-admitted
through the primary creation API. Runtime policy/config loading uses bundled
JSON imports; filesystem access is limited to source verification tests.
