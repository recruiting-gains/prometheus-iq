# Adaptive Outside Sales Intelligence Engine

Subsystem: Prometheus Intelligence Engine

Status: Architecture foundation only.

## Purpose

The Adaptive Outside Sales Intelligence Engine is the long-term intelligence brain of Prometheus. Its job is to turn field activity into explainable, deterministic, enterprise-safe outside-sales decisions.

Prometheus is evolving from route recommendation to outside-sales intelligence. The engine must eventually learn from customer outcomes, CRM records, Research intelligence, Sales context, industry knowledge, territory performance, representative behavior, visit outcomes, and organization-wide trends.

This phase does not implement production integrations. It creates the architecture and reusable contracts future subsystems must follow.

## Existing Work Verification

Already built or partially built:

- Current Route Intelligence exists in the Dashboard and must not be duplicated.
- Route Intelligence V2 architecture exists in `docs/route-intelligence-v2-architecture.md`.
- Continuous Learning Framework exists in `docs/continuous-learning-framework.md`.
- Golden Route Quality Gate v1 exists in `scripts/verify-route-intelligence-quality-gate.mjs`.
- Runtime Pool Governance exists in `scripts/govern-runtime-pool-refresh.mjs` and segmentation outputs.
- Research, Sales, CRM, Data, Dashboard, and Companion each have ownership boundaries.

Reuse decision:

- Reuse existing Route Intelligence as the current recommendation surface.
- Reuse Runtime Data and governance outputs as the trusted route-candidate source.
- Reuse CRM as the customer/account system of record.
- Reuse Research as the external evidence source.
- Reuse Sales as the go-to-market and customer-value source.
- Reuse Companion as a future founder-facing summarization consumer.

Do not duplicate:

- Dashboard runtime logic.
- Active Pool scoring.
- Data governance.
- CRM object model.
- Research source policy.
- Sales methodology.
- Companion reasoning layer.

## Strategic Outcomes

Every future recommendation should be able to answer:

- Why?
- What evidence supports this?
- How confident are we?
- What changed?
- What did we learn?
- How should the next representative behave?

## Architecture Principles

1. Evidence before adaptation.
   Recommendations may adapt only from admitted evidence with a known source, truth level, and confidence weight.

2. Deterministic by default.
   The same evidence snapshot and policy version must produce the same recommendation, confidence, explanation, and audit trace.

3. Explainable at every layer.
   Every recommendation must carry human-readable reasons, evidence references, confidence factors, and change history.

4. Enterprise-safe.
   Tenant boundaries, privacy policy, human override, auditability, and no-secret behavior are required before integrations.

5. Slow learning over overfitting.
   One visit can create a signal. It cannot rewrite the model.

6. Human judgment remains valid.
   Managers and founders must be able to override, annotate, approve, reject, or quarantine learning signals.

## System Layers

### 1. Evidence Intake Layer

Accepts candidate learning events from approved subsystems.

Future sources:

- Dashboard visit outcomes.
- CRM account and opportunity records.
- Research briefs.
- Sales discovery and pilot notes.
- Data governance outputs.
- Territory performance summaries.
- Representative behavior summaries.
- Organization-wide trend summaries.

Output:

- `EvidenceEvent` contract.

### 2. Evidence Admission Layer

Determines whether an event can influence learning.

Required checks:

- Source subsystem is approved.
- Event has a stable ID.
- Tenant, organization, account, territory, and rep scopes are explicit where available.
- Truth level is declared as verified, inferred, estimated, or unknown.
- Sensitive fields are classified.
- Quarantined or invalid route candidates cannot influence confidence.
- Notes remain notes until structured by a future approved parser.

Output:

- admitted evidence
- rejected evidence
- rejection reason
- audit trace

### 3. Signal Normalization Layer

Converts admitted evidence into consistent outside-sales signals.

Signal families:

- visit outcome
- account outcome
- opportunity stage
- territory context
- rep behavior
- route behavior
- industry context
- organization trend
- research insight
- human override

Output:

- `LearningSignal` contract.

### 4. Knowledge Graph Layer

Maintains relationships without becoming the CRM or Dashboard.

Graph nodes:

- organization
- account
- location
- contact
- decision maker
- representative
- territory
- visit
- route
- industry
- signal
- pattern
- recommendation
- override

Graph edges:

- rep visited location
- location belongs to account
- account belongs to organization
- visit produced outcome
- pattern supports recommendation
- research insight informs industry
- override suppresses signal
- recommendation caused route action

Output:

- `KnowledgeGraphFact` contract.

### 5. Confidence Engine

Computes bounded confidence from evidence, not intuition.

Confidence inputs:

- data validity
- Active Pool eligibility
- sample size
- recency
- outcome strength
- consistency
- representative fit
- territory fit
- industry fit
- CRM stage fit
- organizational trend fit
- override status

Confidence outputs:

- numeric confidence band
- maturity level
- confidence factors
- evidence count
- limiting factors
- allowed recommendation influence

Output:

- `ConfidenceAssessment` contract.

### 6. Pattern Detection Layer

Finds patterns without changing production scoring until approved.

Pattern types:

- rep-category fit
- rep-time-window fit
- territory cluster performance
- account-type performance
- route-sequence performance
- skip or revisit behavior
- opportunity-stage behavior
- industry-specific conversion behavior
- organization-wide trend
- negative pattern or saturation

Pattern promotion states:

- observed
- candidate
- validated
- promoted
- deprecated
- suppressed

Output:

- `PatternFinding` contract.

### 7. Opportunity Ranking Layer

Defines future ranking inputs without modifying current scoring.

Ranking must eventually combine:

- governed route-candidate quality
- visit-outcome evidence
- CRM opportunity value
- account health
- customer lifecycle stage
- territory learning
- rep fit
- industry intelligence
- urgency
- confidence
- human override

Output:

- `OpportunityRankingInput`
- `OpportunityRankingResult`

### 8. Recommendation Explanation Engine

Produces founder, manager, and rep-facing explanations.

Every explanation should include:

- recommendation summary
- evidence cited
- confidence level
- what changed since previous recommendation
- what was learned
- recommended next behavior
- uncertainty and limits
- human override status

Output:

- `RecommendationExplanation` contract.

### 9. Human Override Layer

Lets authorized humans correct the intelligence system.

Override types:

- suppress recommendation
- boost recommendation
- quarantine candidate
- mark bad evidence
- mark strong evidence
- annotate customer context
- force exploration
- freeze learning impact
- approve pattern promotion

Output:

- `HumanOverride` contract.

### 10. Learning Contract Registry

Versioned contract layer that prevents implicit integrations.

Rules:

- Every producer must write to an approved contract.
- Every consumer must declare the contract version it accepts.
- Production recommendation changes require an approved implementation handoff.
- Contract changes require validation tests.

Output:

- `LearningContract` registry.

## Capability Foundations

| Capability | Architecture Owner | Future Producers | Future Consumers |
| --- | --- | --- | --- |
| Visit Outcome Learning | Intelligence | Dashboard, CRM | Confidence Engine, Explanation Engine |
| Confidence Engine | Intelligence | Data, Dashboard, CRM, Research | Dashboard, Companion, CRM |
| Recommendation Explanation Engine | Intelligence | Confidence, Pattern Detection | Dashboard, Companion |
| Industry Intelligence | Intelligence contract, Research source | Research, Sales | Confidence, Sales, Companion |
| Territory Intelligence | Intelligence | Dashboard, Data, CRM | Dashboard, CRM, Companion |
| Rep Intelligence | Intelligence | Dashboard, CRM | Dashboard, managers, Companion |
| Organization Intelligence | Intelligence contract, CRM source | CRM | CRM, Companion, executive reports |
| Continuous Learning Pipeline | Intelligence | all approved subsystems | Intelligence validation gates |
| Opportunity Ranking | Intelligence | CRM, Data, Dashboard | Dashboard, CRM |
| Pattern Detection | Intelligence | Learning Signals | Confidence, Explanation |
| Recommendation Confidence | Intelligence | Confidence Engine | Dashboard, Companion, CRM |
| Explainable AI | Intelligence | Explanation Engine | Dashboard, Companion, executive review |
| Human Override | Intelligence contract, owning subsystem UI | Dashboard, CRM, Companion | Confidence, Pattern Detection |
| Knowledge Graph | Intelligence | CRM, Research, Dashboard | Companion, executive reasoning |
| Learning Contracts | Intelligence | all producers | all consumers |

## Determinism Requirements

A future implementation must produce deterministic output when these are identical:

- evidence snapshot
- contract versions
- policy versions
- candidate pool version
- organization scope
- rep scope
- territory scope
- time window
- human overrides

Non-deterministic AI summaries may be used only as optional presentation text. They must not be the source of ranking, confidence, eligibility, or governance decisions.

## Explainability Requirements

Every intelligence output must include:

- source evidence IDs
- truth levels
- confidence factors
- policy version
- contract version
- model or rule version
- recommendation delta from previous snapshot
- unsupported assumptions
- human override state

## Enterprise Safety Requirements

Before production integrations:

- tenant and organization boundaries must exist
- CRM data contracts must be versioned
- Research evidence must retain source attribution
- PII and sensitive fields must be classified
- audit trails must be immutable or append-only
- human override must be available
- rollback behavior must be defined
- zero-live-secret exposure must be preserved
- Golden Route Quality Gate must remain passing for route outputs

## Non-Goals For This Phase

- No production scoring changes.
- No Dashboard runtime changes.
- No Active Pool modifications.
- No Data governance changes.
- No CRM persistence changes.
- No Research ingestion automation.
- No Companion memory integration.
- No customer-facing AI claims.
- No autonomous recommendation learning.

## Future Phases

### Phase 1: Read-Only Evidence Contracts

Create immutable event snapshots from existing exported Dashboard and CRM records. No scoring influence.

### Phase 2: Confidence Audit

Compute confidence assessments beside existing recommendations. No recommendation changes.

### Phase 3: Explanation Upgrade

Expose approved explanation summaries to Founder review. Dashboard implementation requires separate Dashboard handoff.

### Phase 4: Pattern Detection Review

Detect candidate patterns and require human approval before any promotion.

### Phase 5: Bounded Recommendation Influence

Allow validated patterns to contribute bounded confidence adjustments after Golden Route Quality Gate expansion.

### Phase 6: Enterprise Intelligence Graph

Connect CRM, Research, Sales, and territory intelligence through governed contracts and tenant-safe storage.

