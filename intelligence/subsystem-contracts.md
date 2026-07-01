# Adaptive Intelligence Subsystem Contracts

These contracts define future integration boundaries. They do not implement production integrations.

## Contract Rules

- Contracts are append-only until a versioned migration is approved.
- Producers must declare source subsystem, source record ID, truth level, sensitivity, and generated timestamp.
- Consumers must not infer facts from missing fields.
- Recommendations must cite evidence IDs and confidence factors.
- Human overrides must be preserved and visible to downstream consumers.
- Contract changes require validation before production use.

## Core Contracts

### EvidenceEvent

Purpose: preserve one source event that may become learning evidence.

Required fields:

- `eventId`
- `sourceSubsystem`
- `sourceRecordId`
- `eventType`
- `truthLevel`
- `scope`
- `payload`
- `sensitivity`
- `occurredAt`
- `receivedAt`

### LearningSignal

Purpose: normalized signal admitted from one or more evidence events.

Required fields:

- `signalId`
- `sourceEventIds`
- `signalFamily`
- `entityRefs`
- `measurements`
- `confidenceWeight`
- `truthLevel`
- `admissionPolicy`

### ConfidenceAssessment

Purpose: bounded confidence result for a candidate recommendation, pattern, or opportunity.

Required fields:

- `assessmentId`
- `targetRef`
- `confidenceBand`
- `confidenceScore`
- `maturityLevel`
- `supportingEvidence`
- `limitingFactors`
- `allowedInfluence`
- `policyVersion`

### RecommendationExplanation

Purpose: human-readable and machine-readable explanation for why a recommendation exists.

Required fields:

- `explanationId`
- `recommendationRef`
- `summary`
- `why`
- `evidence`
- `confidence`
- `whatChanged`
- `whatWasLearned`
- `nextRepBehavior`
- `uncertainties`
- `overrideState`

### PatternFinding

Purpose: candidate or validated pattern detected from learning signals.

Required fields:

- `patternId`
- `patternType`
- `scope`
- `status`
- `supportingSignals`
- `negativeEvidence`
- `sampleSize`
- `promotionCriteria`
- `reviewState`

### HumanOverride

Purpose: explicit human control over learning or recommendation behavior.

Required fields:

- `overrideId`
- `targetRef`
- `overrideType`
- `reason`
- `createdByRole`
- `createdAt`
- `expiresAt`
- `reviewRequired`

### KnowledgeGraphFact

Purpose: durable relationship used by future Intelligence and Companion reasoning.

Required fields:

- `factId`
- `subject`
- `predicate`
- `object`
- `sourceEvidenceIds`
- `truthLevel`
- `validFrom`
- `validUntil`
- `sensitivity`

### OpportunityRankingResult

Purpose: future output of ranking candidates after approved implementation.

Required fields:

- `rankingId`
- `scope`
- `candidateRefs`
- `rankedResults`
- `confidenceAssessmentIds`
- `explanationIds`
- `policyVersion`
- `determinismKey`

## Producer Boundaries

Dashboard may produce:

- visit outcome events
- recommendation shown events
- route generated events
- skipped or accepted route events after future implementation

CRM may produce:

- account stage changes
- opportunity outcomes
- follow-up completion
- customer health changes
- renewal or expansion events

Research may produce:

- sourced industry intelligence
- competitive intelligence
- market changes
- external risk signals

Sales may produce:

- discovery themes
- pilot success criteria
- objection patterns
- customer-value hypotheses

Data may produce:

- Active Pool quality contracts
- quarantine and reserve status
- territory candidate governance
- refresh deltas

Companion may consume:

- founder-safe summaries
- knowledge graph facts
- architecture state
- decision support explanations

## Consumer Boundaries

Dashboard may consume Intelligence outputs only after Dashboard handoff approval.

CRM may consume account intelligence only after CRM handoff approval.

Research may consume anonymized learning questions only after Research handoff approval.

Companion may consume founder summaries only after Companion handoff approval.

No subsystem may consume these contracts as production behavior until the owning subsystem accepts implementation work.

