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

## August 1 Owner Successor

The original Workflow v2 records above remain immutable historical evidence. They are not treated as current file pins.

Website commit `710ad8a1428dd7621c5363a16fffaae828cc3421` regenerated the approved public payload without changing the governed product boundary. Infrastructure commit `18fbe9906064bad8a0ae8e6fc224e2af0bf1a594` advanced the public rollback contract and Workflow v2 fixtures for that payload. Infrastructure commit `a558df528f0c472d28afb1c3b3041a067ca86c4b` admitted the complete owner chain into the repository-integrity verifier.

The active owner-successor identities are deployment assets `48d3b6b44b49366f3387dfc3e37d8e34d83abf5ea8bb0606b0070851802ff6a1`, rollback contract `b7be296f51db1b8e8a305a068ebc1b0aa7652813de7b5378b96ac292af8af012`, deterministic rollback bundle `012552cf90827482c7f1309f50e492304d9094e1c53f0c7ee6b44a5e0c4e9fbe`, and Infrastructure integrity contract `0582bc185ccf6f5e0825de25ce5fef8c65240fb0ee3b68c22bc5ba14865350c5`.

The release chain is exact and append-only. The four established Overwatch predecessors end at `bc5c03392580470c3549c8e3fe510458e5cdc196`; the governed qualification sequence then pins every subsequent Overwatch, Dashboard, and Intelligence commit through the exact-tail finalization `943baa9c48a85f8b0a57d5a371ff64d486926f8d`. One terminal Overwatch successor refreshes the final verifier fixture and may modify only the eight governance and verification paths enumerated in the JSON record. This preserves each subsystem's actual author and committer identity instead of treating unrelated owner work as Overwatch implementation. The current `package.json` hash resolves through Overwatch commit `610383c4e845789859946122283e8014dae35600`, which registered the August 1 verification commands. No deployment or production mutation is authorized by this successor chain.

## Route IQ Website Positioning Successor

The August 1 records remain immutable historical evidence. They are no longer treated as current Website, deployment-asset, or rollback pins.

Website commit `b83bcaf064ee7b57b28116ffb5e64cbf270605a0` restores customer-facing Route IQ positioning while retaining the governed 3D experience, public request flow, legal protections, and supported claims. Four subsequent Data commits reconcile only the claims-evidence provenance used by release gates. Website commit `72f3f5733f35a4ab56ae528f3a3616b455bd9ee6` regenerates the exact public deployment assets. Infrastructure commit `a370836879b160e88c0e7e821003e66759cc97c4` advances only the rollback contract and its Workflow v2 fixtures.

The controlling release identities are deployment assets `ce5279cb7f1b904457bb83d5b844b3f7339a586544d0a36b4eb3e41c1715276e`, rollback contract `df9a90e39076df62bb6c3ec521a9dd86afe8d65f0836645237dbc2d08c69302d`, deterministic rollback bundle `37f215ffe57df61aaa741352111806b07ff1a97dabd07c36188080e62857e582`, and Workflow v2 contract `17ac6ac53220f77fe2d49339e7a93566c7c2419bb19c462200a2077f1df34ca7`.

This successor records release provenance and independent verification only. It does not request or grant deployment authorization, contact Cloudflare, mutate production, submit a CRM request, send a notification, or change the private Worker.
