# Gaia Research Orchestrator Foundation v1

Owner: Prometheus Research

Status: Active Research architecture

Production runtime change: false

## Mission

Gaia is the Prometheus Research evidence orchestrator and executive intelligence engine.

Gaia does not replace external GPTs, connectors, plugins, databases, or research tools. Gaia orchestrates them.

External GPTs and evidence providers supply evidence. Gaia validates evidence, scores evidence, organizes evidence, resolves uncertainty, and produces Executive Intelligence.

## Core Principle

Every evidence source is replaceable.

If a superior research provider exists tomorrow, Gaia must be able to replace the old provider without changing its reasoning architecture.

Provider replacement must not change:

- Evidence normalization.
- Provenance tracking.
- Duplicate detection.
- Conflict resolution.
- Confidence assignment.
- Unknown identification.
- Evidence quality scoring.
- Executive Intelligence synthesis.

## Provider-Agnostic Research Orchestrator

Future research requests may use any approved evidence provider, including:

- Apollo.
- Marketing Research GPT.
- Consensus.
- SciSpace.
- AskYourPDF.
- Public Web Research.
- CRM through future approved Research-safe handoff only.
- Future approved evidence providers.

These providers are interchangeable. Gaia must never depend on a single provider.

Provider role:

- Collect candidate evidence.
- Return source references where available.
- Return raw findings, quotes, metadata, search criteria, filters, and limitations.
- Identify what was searched and what was not searched.
- Avoid executive recommendations.

Gaia role:

- Validate evidence.
- Normalize evidence.
- De-duplicate evidence.
- Resolve conflicting evidence.
- Track evidence provenance.
- Assign confidence.
- Identify unknowns.
- Score evidence quality.
- Forward validated evidence into Executive Intelligence.
- Produce executive recommendations only after evidence quality supports them.

## Evidence Engine Responsibilities

The Gaia Evidence Engine owns the permanent evidence processing pipeline.

1. Collect evidence.
2. Normalize evidence.
3. Remove duplicate findings.
4. Resolve conflicting evidence.
5. Track evidence provenance.
6. Assign confidence.
7. Identify unknowns.
8. Score evidence quality.
9. Forward validated evidence into Executive Intelligence.

## Evidence Intake Contract

Every provider response must be converted into a Gaia evidence item before it can influence Research output.

Required evidence item fields:

- `evidenceId`
- `provider`
- `providerType`
- `workspaceId`
- `researchQuestion`
- `claim`
- `evidenceType`
- `sourceReferences`
- `sourceAccessMethod`
- `retrievedAt`
- `providerSearchCriteria`
- `providerFilters`
- `rawFinding`
- `normalizationStatus`
- `duplicateGroupId`
- `conflictGroupId`
- `provenance`
- `confidence`
- `evidenceQualityScore`
- `knownLimitations`
- `unknownsCreated`
- `allowedForExecutiveIntelligence`

## Provider Types

Approved provider types:

- `lead_contact_company_enrichment`
- `academic_research`
- `scientific_literature`
- `document_analysis`
- `public_web_research`
- `market_research_gpt`
- `crm_approved_handoff`
- `future_approved_provider`

Provider examples:

- Apollo: `lead_contact_company_enrichment`
- Marketing Research GPT: `market_research_gpt`
- Consensus: `academic_research`
- SciSpace: `scientific_literature`
- AskYourPDF: `document_analysis`
- Public Web Research: `public_web_research`
- CRM: `crm_approved_handoff`

## Evidence Labels

Gaia must preserve the Executive Intelligence evidence labels:

- Observed.
- Corroborated.
- Owner-provided.
- Unknown.
- Inference.

Provider findings are not automatically Observed or Corroborated.

External-provider findings start as provider evidence and must be validated before they become decision-ready evidence.

## Provenance Standard

Gaia must retain:

- Provider name.
- Provider type.
- Query/search prompt.
- Filters used.
- Number of results returned when applicable.
- Number of results rejected when applicable.
- Number of results advanced when applicable.
- Source URLs or file references where available.
- Retrieval date.
- Provider limitations.
- Whether the source is primary, secondary, directional, or enrichment-only.
- Whether the finding was corroborated.

## Duplicate Prevention

Gaia must detect duplicate findings when:

- Multiple providers return the same source.
- Multiple providers repeat the same claim from the same underlying source.
- A provider summarizes another source already collected.
- A public web source and a GPT provider cite the same original article, company page, filing, paper, or document.

Duplicate findings are grouped under a `duplicateGroupId`.

Duplicate evidence may increase visibility but must not inflate confidence unless it comes from independent sources.

## Conflict Resolution

Gaia must create a `conflictGroupId` when evidence conflicts.

Conflicts include:

- Different ownership claims.
- Different location counts.
- Different dates.
- Different role/title claims.
- Different expansion signals.
- Different financial or capital-readiness indicators.
- Provider summary contradicts primary source.

Conflict outcomes:

- `resolved_primary_source_controls`
- `resolved_owner_provided_controls`
- `resolved_multiple_sources_corroborate`
- `unresolved_conflict`
- `insufficient_evidence`

Unresolved conflicts must create unknowns and verification questions.

## Confidence Assignment

Confidence is assigned by Gaia, not by external providers.

Confidence inputs:

- Source tier.
- Source independence.
- Primary-source availability.
- Recency.
- Directness.
- Corroboration.
- Contradictions.
- Provider limitations.
- Completeness.
- Relevance to the decision.

Confidence levels:

- High.
- Medium-high.
- Medium.
- Medium-low.
- Low.
- Unknown.

## Evidence Quality Score

Gaia scores each evidence item from 0 to 100.

Scoring dimensions:

- Source reliability: 25.
- Directness to claim: 20.
- Corroboration: 20.
- Recency: 10.
- Provider transparency: 10.
- Conflict status: 10.
- Decision relevance: 5.

Evidence cannot be forwarded into Executive Intelligence unless:

- It has provenance.
- It has source reliability.
- It has confidence.
- It has a quality score.
- It is labeled.
- It has known limitations.
- It is not blocked by sourcing rules.

## Executive Recommendation Boundary

External GPTs never produce executive recommendations.

External GPTs provide evidence.

Gaia validates.

Gaia scores.

Gaia organizes.

Gaia produces Executive Intelligence.

Gaia recommends.

Provider outputs may include provider-suggested interpretations, but Gaia must treat those as raw findings, not recommendations.

## Executive Intelligence Handoff

Only validated evidence can move into Executive Intelligence.

Executive Intelligence receives:

- Validated claims.
- Evidence labels.
- Provenance.
- Confidence.
- Evidence quality score.
- Duplicate groups.
- Conflict groups.
- Unknowns.
- Verification questions.
- Source references.
- Provider limitations.

Executive Intelligence does not receive:

- Unvalidated provider claims as final facts.
- Apollo-only ownership or capital-readiness claims.
- External GPT recommendations as executive recommendations.
- CRM data without future approved Research-safe handoff.
- Unsupported scraped data.

## Protected Boundaries

This architecture does not modify:

- Route IQ.
- Athena.
- Dashboard.
- Infrastructure.
- Website.
- CRM.
- Companion.
- Mobile.
- Fitness Connection.
- Intelligence runtime.
- Production data.

## Validation Requirements

Research validation must confirm:

- Gaia provider list includes Apollo, Marketing Research GPT, Consensus, SciSpace, AskYourPDF, Public Web Research, CRM, and future approved evidence providers.
- Gaia provider architecture is provider-agnostic.
- External GPTs are evidence providers only.
- Gaia owns validation, scoring, organization, Executive Intelligence, and recommendations.
- Evidence Engine responsibilities cover collection, normalization, duplicate removal, conflict resolution, provenance, confidence, unknowns, evidence quality, and Executive Intelligence handoff.
- Protected subsystem boundaries remain unchanged.
