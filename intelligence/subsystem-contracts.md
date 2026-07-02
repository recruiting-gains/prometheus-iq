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

## Field Learning Loop Contracts

These contracts specialize the adaptive intelligence architecture for completed field visits. They remain architecture-only until a future production activation handoff is approved.

### FieldEvidenceEvent

Purpose: preserve one completed-visit evidence record without changing production recommendations.

Required fields:

- `evidenceId`
- `contractVersion`
- `sourceSubsystem`
- `sourceRecordId`
- `businessRef`
- `repRef`
- `visitOccurredAt`
- `capturedAt`
- `evidenceFields`
- `truthLevel`
- `sensitivity`
- `reviewState`

Supported evidence fields:

- business visited
- date/time
- GPS confirmation
- decision maker reached
- conversation occurred
- sale made
- no decision maker
- closed business
- wrong business
- duplicate
- no parking
- gatekeeper
- follow-up needed
- competitor present
- customer objections
- notes
- photos as future evidence

### FieldEvidenceAdmissionDecision

Purpose: document whether a field evidence record is allowed to become a learning signal.

Required fields:

- `decisionId`
- `evidenceId`
- `admissionStatus`
- `admissionReasons`
- `rejectionReasons`
- `policyVersion`
- `reviewRequired`
- `decidedAt`

### FieldLearningSignal

Purpose: normalize admitted field evidence into deterministic learning signals.

Required fields:

- `signalId`
- `sourceEvidenceIds`
- `signalFamily`
- `businessRef`
- `territoryRef`
- `repRef`
- `measurements`
- `confidenceWeight`
- `truthLevel`
- `learningTrend`
- `allowedInfluence`
- `policyVersion`

### FieldConfidenceSnapshot

Purpose: prepare future recommendation confidence metadata.

Required fields:

- `confidenceId`
- `targetRef`
- `confidenceBand`
- `confidenceScore`
- `evidenceCount`
- `lastValidationAt`
- `learningTrend`
- `supportingEvidenceIds`
- `limitingFactors`
- `allowedInfluence`
- `reviewState`
- `policyVersion`

### FieldRecommendationExplanation

Purpose: prepare future explanation output for founder and manager review.

Required fields:

- `explanationId`
- `recommendationRef`
- `why`
- `whatEvidence`
- `howConfident`
- `whatChanged`
- `whatWasLearned`
- `nextRepBehavior`
- `uncertainties`
- `reviewState`
- `policyVersion`

### FieldHumanOverride

Purpose: keep every learned outcome reviewable and controllable by humans.

Required fields:

- `overrideId`
- `targetRef`
- `overrideType`
- `reason`
- `createdByRole`
- `createdAt`
- `expiresAt`
- `reviewRequired`
- `auditState`

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
