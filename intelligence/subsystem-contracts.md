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

## Recommendation Explainability Contracts

These contracts prepare natural-language recommendation explanations for future consumers. They do not change scoring, ranking, Dashboard behavior, or production recommendations.

### RecommendationExplanationV1

Purpose: answer why a recommendation exists without exposing internal scoring formulas or proprietary weights.

Required fields:

- `explanationId`
- `contractVersion`
- `recommendationRef`
- `headline`
- `summary`
- `answers`
- `factorGroups`
- `evidenceSummary`
- `confidenceDisplay`
- `reviewState`
- `safety`

Required answer fields:

- `why`
- `howConfident`
- `whatEvidenceSupportsIt`
- `whatChanged`
- `whatShouldIDoNext`

Factor groups:

- Location Intelligence
- Business Intelligence
- Historical Intelligence
- Route Intelligence
- Learning Intelligence

Safety requirements:

- natural conversational language
- no internal scoring formulas
- no proprietary weights
- no production recommendation changes
- no Dashboard runtime changes
- no Active Pool changes
- human override state remains visible

### MobileRecommendationExplanation

Purpose: compact explanation payload for future mobile "Why?" views.

Required fields:

- `contractVersion`
- `consumer`
- `recommendationRef`
- `headline`
- `summary`
- `factorBullets`
- `confidenceDisplay`
- `nextAction`
- `reviewState`

### DashboardRecommendationExplanation

Purpose: full explanation payload for future Dashboard inspection.

Required fields:

- `contractVersion`
- `consumer`
- `recommendationRef`
- `headline`
- `summary`
- `factorGroups`
- `evidenceSummary`
- `confidenceDisplay`
- `whatChanged`
- `nextAction`
- `reviewState`

### CompanionRecommendationExplanation

Purpose: founder-review explanation payload for future Companion summaries.

Required fields:

- `contractVersion`
- `consumer`
- `recommendationRef`
- `headline`
- `summary`
- `factorGroups`
- `evidenceSummary`
- `confidenceDisplay`
- `whatChanged`
- `nextAction`
- `reviewState`
- `founderReviewNotes`

## Operating Profile Contracts

These contracts let future subsystems adopt the selected outside-sales operating profile. They are architecture-only and do not authorize production consumption.

### OperatingProfile

Purpose: define industry-specific terminology, KPIs, success events, outcome vocabulary, labels, CRM stages, Companion wording, and reporting language.

Required fields:

- `profileId`
- `label`
- `industry`
- `terminology`
- `kpis`
- `successEvents`
- `outcomeVocabulary`
- `dashboardLabels`
- `crmStages`
- `companionWording`
- `reportingLanguage`
- `outcomeMappings`

### OperatingProfileOutcomeMapping

Purpose: map industry-specific outcomes into normalized evidence vocabulary.

Required fields:

- `terms`
- `normalizedOutcome`

### NormalizedOutcomeEvent

Purpose: preserve the architecture chain from field visit to recommendation eligibility.

Required fields:

- `normalizedOutcomeId`
- `profileId`
- `rawOutcome`
- `normalizedOutcome`
- `stageSequence`
- `evidence`
- `learningSignalSeed`
- `confidenceSeed`
- `recommendationEligibility`
- `explanationSeed`

### DashboardOperatingProfileContract

Purpose: future Dashboard label and vocabulary contract.

Required fields:

- `contractVersion`
- `consumer`
- `profileId`
- `dashboardLabels`
- `terminology`
- `outcomeVocabulary`
- `runtimeConsumptionAuthorized`

### CRMOperatingProfileContract

Purpose: future CRM stage and outcome vocabulary contract.

Required fields:

- `contractVersion`
- `consumer`
- `profileId`
- `crmStages`
- `outcomeVocabulary`
- `runtimeMutationAuthorized`

### CompanionOperatingProfileContract

Purpose: future Companion wording contract.

Required fields:

- `contractVersion`
- `consumer`
- `profileId`
- `companionWording`
- `runtimeConsumptionAuthorized`

### MobileOperatingProfileContract

Purpose: future Mobile vocabulary and label contract without changing Anthony beta behavior.

Required fields:

- `contractVersion`
- `consumer`
- `profileId`
- `terminology`
- `dashboardLabels`
- `mobileBetaChanged`

### WebsiteOperatingProfileContract

Purpose: future Website reporting-language contract.

Required fields:

- `contractVersion`
- `consumer`
- `profileId`
- `reportingLanguage`
- `websiteChanged`

### ResearchOperatingProfileContract

Purpose: future Research terminology and outcome-vocabulary contract.

Required fields:

- `contractVersion`
- `consumer`
- `profileId`
- `industry`
- `terminology`
- `outcomeVocabulary`
- `runtimeConsumptionAuthorized`

### SalesOperatingProfileContract

Purpose: future Sales terminology, KPI, and success-event contract.

Required fields:

- `contractVersion`
- `consumer`
- `profileId`
- `terminology`
- `kpis`
- `successEvents`
- `runtimeConsumptionAuthorized`

### SocialMediaOperatingProfileContract

Purpose: future Social Media terminology and reporting-language contract.

Required fields:

- `contractVersion`
- `consumer`
- `profileId`
- `terminology`
- `reportingLanguage`
- `runtimeConsumptionAuthorized`

## Customer Intelligence Graph Contracts

These contracts prepare per-customer intelligence graphs. They do not implement graph consumers or change production scoring, production recommendations, Dashboard behavior, Mobile behavior, Companion behavior, CRM runtime behavior, Research runtime behavior, or Sales runtime behavior.

### CustomerGraphNode

Purpose: represent one customer-owned graph entity.

Required fields:

- `nodeId`
- `nodeType`
- `customerId`
- `sourceRefs`
- `attributes`
- `reviewState`
- `sensitivity`
- `validFrom`

Supported node types:

- Business
- Visit
- Lead
- Outcome
- Rep
- Territory
- Operating Profile
- Customer
- Learning Signal

### CustomerGraphRelationship

Purpose: represent one reviewable relationship between customer-owned nodes.

Required fields:

- `relationshipId`
- `relationshipType`
- `fromNodeId`
- `toNodeId`
- `customerId`
- `sourceEvidenceIds`
- `confidenceSeed`
- `reviewState`
- `validFrom`
- `validUntil`

Supported relationship types:

- Visited
- Recommended
- Converted
- Follow-up
- Nearby
- Similar
- Repeated
- Successful
- Inactive

### CustomerGraphSnapshot

Purpose: hold a deterministic architecture-only graph snapshot for one customer and one operating profile context.

Required fields:

- `graphId`
- `contractVersion`
- `customerId`
- `operatingProfileId`
- `nodes`
- `relationships`
- `objectives`
- `safety`

### DashboardCustomerGraphContract

Purpose: future Dashboard graph inspection contract.

Required fields:

- `contractVersion`
- `consumer`
- `customerId`
- `allowedNodeTypes`
- `allowedRelationshipTypes`
- `runtimeConsumptionAuthorized`

### CRMCustomerGraphContract

Purpose: future CRM graph relationship contract.

Required fields:

- `contractVersion`
- `consumer`
- `customerId`
- `allowedNodeTypes`
- `allowedRelationshipTypes`
- `runtimeMutationAuthorized`

### MobileCustomerGraphContract

Purpose: future Mobile graph context contract.

Required fields:

- `contractVersion`
- `consumer`
- `customerId`
- `allowedNodeTypes`
- `allowedRelationshipTypes`
- `mobileRuntimeChanged`

### CompanionCustomerGraphContract

Purpose: future Companion graph reasoning contract after Founder review.

Required fields:

- `contractVersion`
- `consumer`
- `customerId`
- `allowedNodeTypes`
- `allowedRelationshipTypes`
- `companionRuntimeChanged`

### ResearchCustomerGraphContract

Purpose: future Research graph question and cross-industry learning contract.

Required fields:

- `contractVersion`
- `consumer`
- `customerId`
- `allowedNodeTypes`
- `allowedRelationshipTypes`
- `runtimeConsumptionAuthorized`

### SalesCustomerGraphContract

Purpose: future Sales graph trend and opportunity narrative contract.

Required fields:

- `contractVersion`
- `consumer`
- `customerId`
- `allowedNodeTypes`
- `allowedRelationshipTypes`
- `runtimeConsumptionAuthorized`

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
