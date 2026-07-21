# Public Deployment Workflow v2 Governance

Owner: Prometheus Overwatch
Implementation owner: Prometheus Infrastructure
Batch: `BATCH-20260720-010`
Production action: none

## Dispatch Audit

Prometheus Infrastructure owns the qualification workflow, immutable release construction, deployment adapter, Cloudflare read and deploy boundary, GET/HEAD smoke plan, and forward-compatible rollback mechanics. Prometheus Overwatch owns this governance record, provenance mapping, registry wiring, and independent release gates. Overwatch did not modify Infrastructure implementation files.

Infrastructure successor commit `3743db6f883f44b6d1d1dd69bc1a9c79f6d8b6de` independently updated the historical public-release provenance verifier to admit the correctly owned Workflow v2 chain. Overwatch pins that commit's identity, parent, tree, exact four-file scope, and file hashes; it does not claim or alter Infrastructure ownership.

Infrastructure successor commit `9c6440ba3c286b06a79435a8ec7bdf477cb4fd79` closes the production-boundary audit finding. Overwatch pins its Infrastructure identity, parent, tree, eight-file scope, and exact hashes. The repair remains Infrastructure-owned; Overwatch records and independently verifies it.

## Governed Lifecycle

`Qualify Prometheus Public Worker` runs the complete no-secret repository suite in the pinned deployment environment, builds the public deployment payload exactly once, creates a deterministic manifest, and uploads the content-addressed release. It cannot access protected deployment secrets or contact Cloudflare.

`Deploy Prometheus Public Worker` downloads the exact qualified artifact and cannot rebuild it. Local artifact, repository, workflow, rollback, target, and toolchain checks happen before Cloudflare access. Only the exact public and private Worker identity and binding prerequisites may be read before authorization. Founder authorization is consumed only after the single forward Wrangler deployment process emits its successful spawn event.

An invocation-construction or process-spawn failure records that deployment never began, leaves authorization unconsumed, performs no production mutation, and leaves an unchanged qualified candidate valid. Any failure after successful process spawn consumes that authorization and cannot retry automatically. A source, contract, manifest, payload, rollback identity, target, or prerequisite change invalidates the candidate and requires new qualification and authorization.

Postdeployment smoke uses only fixed GET and HEAD requests with no body. A critical failure may invoke one verified forward-compatible rollback payload. Native rollback, private Worker mutation, CRM submission, notification, collection activation, cohort activation, recommendation influence, and Anthony mapping remain prohibited.

## Product Continuity

The Infrastructure owner commit does not alter Website, CRM, Data, Dashboard, Intelligence, or private Worker implementation. The approved Route IQ 3D website and CRM deployment assets retain SHA-256 `5fd9e497e7fe814aab6194b4302528c6cff0e243e76a3dd843738f1882cd8c15`.

This batch changes and verifies the release system only. It does not request or grant deployment authorization.
