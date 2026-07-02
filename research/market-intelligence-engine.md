# Market Intelligence Engine v1

Subsystem: Prometheus Research

Status: Architecture and validation foundation only.

## Mission

The Market Intelligence Engine transforms Research from information gathering into strategic market intelligence. Its job is to recommend where Prometheus should expand next after evidence is collected, scored, and reviewed.

Market Intelligence Engine v1 does not produce live market rankings, scrape sources, deploy runtime services, or modify production systems. It defines the reusable scoring model, evidence requirements, ranking outputs, and founder-ready recommendation format.

## Strategic Question

The engine exists to answer:

> Which outside-sales market should Prometheus pursue next, and why?

Every recommendation must connect external evidence to Prometheus' company identity: an AI operating system for outside sales organizations, not a single-industry tool.

## Capabilities

Market Intelligence Engine v1 supports:

- Market opportunity scoring.
- Industry attractiveness analysis.
- Outside-sales market ranking.
- Competitor movement tracking.
- AI trend tracking.
- Partnership opportunities.
- Geographic expansion opportunities.
- Enterprise target identification.

## Architecture

### 1. Market Intake

Inputs:

- Recurring Research briefings.
- Approved source-register sources.
- Competitor movement observations.
- AI trend observations.
- Industry pain-point evidence.
- Funding and enterprise technology signals.
- Partnership and channel signals.
- Geographic density and territory signals.

Rejected inputs:

- Unsupported scraped material.
- Private customer data.
- Production Dashboard data.
- Companion review material.
- CRM runtime data.
- Mobile runtime data.
- Intelligence runtime data.

### 2. Evidence Admission

Every market signal must include:

- Source reference.
- Source tier.
- Publication or retrieval date.
- Claim.
- Relevance to outside sales.
- Confidence.
- Limitation.
- Fact, hypothesis, or unknown label.

Signals without source references stay in `hypothesis` status and cannot drive founder-ready recommendations.

### 3. Scoring Model

The scoring model is defined in `research/registers/market-intelligence-model.json`.

The model scores candidate markets across:

- Outside-sales intensity.
- Pain severity.
- Buyer urgency.
- Route and territory complexity.
- Data availability.
- Competitive whitespace.
- Enterprise revenue potential.
- Regulatory friction.
- Partnership leverage.
- Geographic density.
- Prometheus implementation fit.

Scores are evidence-weighted. A market with attractive assumptions but weak evidence must remain lower confidence than a market with stronger sourced proof.

### 4. Market Ranking

Ranking output must include:

- Candidate market.
- Total weighted score.
- Confidence band.
- Evidence count.
- Top opportunities.
- Top risks.
- Expansion thesis.
- Recommended founder action.
- Source references.
- Review state.

No ranking can be marked founder-ready unless every required section has source references or is explicitly marked as hypothesis.

### 5. Recommendation Layer

Founder-ready output must be decisive but honest:

- Recommend one next expansion market or defer if evidence is insufficient.
- Explain why that market outranks alternatives.
- Identify what Prometheus should test first.
- Identify what would falsify the recommendation.
- Identify sales, website, and future Intelligence handoffs.

## Relationship To Customer Intelligence Graph

The Customer Intelligence Graph is customer-specific and architecture-only. Market Intelligence Engine v1 is market-level and Research-owned.

Market Intelligence must not:

- Consume Customer Intelligence Graph runtime data.
- Create a parallel customer graph.
- Write graph nodes or relationships.
- Activate confidence propagation.
- Mix customer-specific data across markets.

Market Intelligence may prepare future ResearchCustomerGraphContract questions only after an approved Intelligence Engine handoff.

## Production Boundaries

This engine must not modify:

- Companion.
- Dashboard.
- CRM.
- Mobile.
- Intelligence runtime.
- Website runtime.
- Infrastructure.
- Production data.

## Founder-Ready Output Standard

A market recommendation is founder-ready only when it includes:

- Summary.
- Market score.
- Why it matters.
- Impact on Prometheus.
- Opportunities.
- Risks.
- Recommended founder actions.
- Source references.
- Confidence and limitations.
- Future handoff candidates.

## Initial Candidate Universe

The initial candidate universe is unscored until current evidence is collected:

- Healthcare field sales.
- Medical device sales.
- Solar.
- Roofing.
- Pest control.
- Security.
- Telecom.
- Commercial services.
- Industrial sales.
- Logistics.
- Fitness and gyms as validation baseline.

## Non-Goals

- No production scoring.
- No runtime market ranking service.
- No live integrations.
- No unsupported scraping.
- No Companion changes.
- No Dashboard changes.
- No CRM changes.
- No Mobile changes.
- No Intelligence runtime changes.
- No deployment required.
