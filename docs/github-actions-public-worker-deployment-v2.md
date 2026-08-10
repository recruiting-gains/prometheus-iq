# Public Deployment Workflow v2

Owner: Prometheus Infrastructure
Batch: `BATCH-20260720-010`
Production status: not executed by this batch

## Lifecycle

1. Overwatch closes ordinary engineering failures under the standing autonomous closure policy.
2. `Qualify Prometheus Public Worker` runs from exact `main` on `ubuntu-24.04` with Node `24.4.1`, `npm ci`, Wrangler `4.120.1`, a deterministic source build needed by clean-checkout verifiers, and the complete no-secret repository suite.
3. Qualification creates the deployable Worker payload exactly once and emits one content-addressed release directory.
4. GitHub stores the immutable release under a unique artifact ID. The payload and manifest have independent SHA-256 identities; the upload action also supplies its transport digest.
5. A Founder authorization names the candidate, production prerequisites, qualification run and artifact IDs, payload and manifest hashes, deployment assets, rollback identities, and Workflow v2 contract.
6. `Deploy Prometheus Public Worker` downloads only that artifact, verifies every identity, and performs no source build.
7. The protected job performs an artifact-local Wrangler `--no-bundle --dry-run`, validates the current public and private versions with two bounded read-only Cloudflare checks, then records authorization consumption only after Node confirms that the one permitted forward deployment child spawned successfully.
8. The fixed GET/HEAD smoke plan runs after deployment. Critical failure permits only the qualified forward-compatible rollback payload. Noncritical failure is reported without another production mutation.

## Artifact Layout

```text
manifest.json
payload/
  forward/
    wrangler-qualified.json
    worker/
    assets/
  rollback/
    identity/
    deployable/
      wrangler-qualified.json
      worker/
      assets/
```

The manifest records the exact Git commit and tree, batch, current public/private prerequisites, payload hash, deployment asset hash, rollback contract and artifact hashes, workflow and contract hashes, lockfile and package hashes, pinned toolchain, and safety switches. It intentionally contains no timestamp, run ID, artifact ID, secret, or self-referential manifest hash. The separate manifest SHA-256 and immutable GitHub artifact ID complete the release identity.

The deployment config inside each payload points only to already generated Worker JavaScript and exact static assets. Deployment uses `--no-bundle`; `npm run build`, `npm test`, Vite, and Wrangler bundling are prohibited in the deployment workflow.

## Authorization Boundary

Local verification, artifact download, artifact hashing, repository validation, dependency installation, and the no-bundle dry run occur before any Cloudflare request. A failure there records only `DEPLOYMENT_NOT_BEGUN` and never consumes authorization.

Read-only current-version checks occur after the local pre-boundary has passed. They do not consume the Founder authorization and are the only Cloudflare requests allowed before consumption. Authorization is consumed by an append-only `AUTHORIZATION_CONSUMED` phase only when the forward Wrangler deployment child emits Node's successful `spawn` event. That child can be invoked once. Ambiguous or failed execution is never retried automatically.

Invocation construction happens before the child-process call. A construction failure, synchronous spawn failure, or asynchronous spawn failure before Node's `spawn` event leaves authorization unconsumed and still ends the workflow with no automatic retry. The successful `spawn` event is the mutation boundary because the child then exists with production credentials and authority to issue the Cloudflare mutation. Authorization is recorded synchronously at that event before normal child completion is accepted. Any error, timeout, signal, or uncertain result after that point remains consumed and cannot be retried.

An external runner interruption before `AUTHORIZATION_CONSUMED` does not alter the qualified candidate. A changed commit, tree, manifest, artifact, workflow contract, rollback identity, target, or production prerequisite requires a new qualification and a new authorization.

## Safety

- Target is fixed to `prometheusrouteiq-website`; `prometheus-iq` cannot be selected.
- The private Worker version is checked and must remain byte-for-byte unchanged as Cloudflare state.
- Existing bindings and protected settings are preserved with `--keep-vars` and strict remote-change checking.
- CRM POSTs, notifications, request bodies, collection activation, cohorts, recommendation influence, and Anthony mapping are prohibited.
- Smoke uses only the fixed GET/HEAD contract.
- Native Cloudflare rollback, deleted-class migration, namespace deletion, and historical rewrite remain prohibited.
- Qualification and deployment artifacts contain no secret values. Protected settings enter only the bounded deployment child through the existing masked environment and owner-only temporary secrets file.

## Integration Boundary

Infrastructure owns these mechanics and their contract. Overwatch must separately add release wiring, successor hash pins, ownership mappings, and the standing autonomous-closure governance record. Until that integration passes the full exact-HEAD suite, Workflow v2 is source-complete but not a qualified deployment candidate.
