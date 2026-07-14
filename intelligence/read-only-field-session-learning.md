# Read-Only Field Session Learning Architecture v1

## Purpose

This layer activates the first Intelligence-owned projection over verified Route IQ field sessions. Prometheus Data remains the source owner. Intelligence reads canonical archived records, calculates governed confidence, and publishes a deterministic learning snapshot without changing archived evidence, Route IQ scoring, or recommendation behavior.

`BATCH-20260714-004` pins Data's final retention policy through `c73118ddb262d3010bbc94a900f8506fb2f56192`. Archived-session learning cannot promote prospective evidence; any future prospective use requires Data-authenticated, hash-bound admission with an authoritative legal-hold ledger, an 18 UTC calendar-month maximum from canonical creation, and customer shortening only. The exact July 14 automation-smoke archive remains hash-only audit evidence and is excluded from learning and every downstream metric, while unrelated undisposed zero-visit sessions are not excluded by inference.

## Authorization Boundary

The Data field-session handoff requires a separate independent consumer authorization. `read-only-field-session-learning-contracts-v1` supplies that authorization for the registered Fitness Connection repository archive only. It does not alter the Data contract, grant access to the Data persistence binding, or authorize raw evidence consumption.

Approved source records are limited to:

- the archived-session manifest used for scope, finality, and artifact resolution;
- `verified_field_session`;
- `calculated_field_session_metrics`;
- `field_session_history_updates`.

Raw reports, stress-test observations, failed submissions, partial sessions, fixtures, synthetic sessions, and unverified evidence are not learning inputs.

## Processing Model

The engine performs a deterministic read-only snapshot projection:

1. Validate the independent Intelligence authorization.
2. Validate workspace, operating profile, archive status, source finality, record kinds, identity consistency, and provenance.
3. Reject duplicate session identities rather than replaying them.
4. Aggregate only fields already verified or calculated by Data.
5. Apply policy-configured recency weighting and evidence decay to learning confidence only.
6. Evaluate policy-configured evidence thresholds for representative, territory, category, and business conclusions.
7. Emit a deeply frozen Intelligence-owned snapshot with evidence references and confidence explanations.

No normalization is performed. Notes are not parsed into objections or follow-up claims. A `Membership` outcome label does not become a membership count when Data records the membership field as unavailable.

## Learning Outputs

The snapshot contains:

- Representative Intelligence: verified activity, outcomes, category observations, time-window evidence, and unavailable follow-up or frequency claims.
- Territory Intelligence: verified territory observations when a source territory exists; otherwise an explicit unavailable result.
- Category Intelligence: verified category totals and rates without declaring a best category below threshold.
- Business Intelligence: immutable historical interactions and verified outcomes per Google Place identity.
- Learning Confidence: threshold progress, recency weight, limiting factors, and recommendation-influence eligibility.
- Evidence Confidence: source finality, provenance, approved record kinds, and source hashes.
- Learning History: session contributions, never replay events or invented historical evidence.
- Learning Version: engine, policy, contract, and source archive versions.

Every conclusion identifies the evidence used, evidence count, confidence, last update, workspace, representative, and territory.

## Threshold Safety

All evidence minima, confidence bands, recency settings, and decay settings live in `read-only-field-session-learning-policy-v1.json`. The engine has no embedded visit, conversation, lead, membership, or confidence thresholds.

The first verified session remains observation-only. Recommendation influence is disabled pending a future explicit handoff even if thresholds are eventually met. This task does not change Route IQ scoring weights or recommendation ordering.

## Ownership And Immutability

Data owns every source archive artifact and all source provenance. Intelligence owns only the contract, policy, engine, and generated learning snapshot. The engine exposes no archive write, delete, overwrite, replay, or backfill operation. Inputs are cloned for projection, checked for mutation, and never persisted by the engine.

## Fail-Closed Rules

- Unknown or protected workspaces are rejected.
- Operating-profile mismatches are rejected.
- Missing, partial, failed, duplicate, unverified, fixture, test, demo, or synthetic sessions are rejected.
- Record-kind, session-identity, source-hash, or provenance mismatches are rejected.
- Missing territory remains unavailable instead of being inferred.
- Missing memberships, structured follow-up, objections, route history, scores, or explanations remain unavailable.

## Consumer Boundary

No Dashboard, CRM, Companion, Mobile, Data, or Infrastructure consumer is activated by this layer. The generated snapshot is an Intelligence artifact for Overwatch review and future separately authorized consumers.
