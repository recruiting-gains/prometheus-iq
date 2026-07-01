# Research Intelligence Foundation v1

Subsystem: Prometheus Research

## Strategic Role

Prometheus Research exists to become the company's strategic intelligence division. It turns external market evidence into structured intelligence for founder decisions and future product direction.

Research does not own production behavior. Research owns intelligence intake, evidence quality, classification, synthesis, and handoff readiness.

## Scope

Research covers:

- AI industry developments.
- Startup funding activity.
- Competitor intelligence.
- Outside sales best practices.
- Route optimization research.
- Customer acquisition trends.
- Sales psychology.
- Enterprise software trends.
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
- Emerging technologies.
- Patent activity.
- Government and regulatory changes affecting field sales.
- Market opportunities.
- Founder education.
- Venture capital trends.

## Architecture

Research Foundation v1 has five layers.

### 1. Intake Layer

Purpose: identify candidate developments worth tracking.

Accepted intake types:

- Company announcements.
- Product launches.
- Funding announcements.
- Regulatory updates.
- Patent publications.
- Market reports.
- Credible industry analysis.
- Academic or technical research.
- Founder-requested questions.
- Customer pain signals from approved internal notes.

Rejected intake types:

- Unsupported scraped content.
- Anonymous claims without corroboration.
- Private customer data.
- Production telemetry.
- Credentials, secrets, or exported production backups.

### 2. Evidence Layer

Purpose: preserve attribution and classify confidence.

Every research item should include:

- Source title.
- Publisher or owner.
- URL or repository path when available.
- Publication date or retrieval date.
- Source type.
- Trust tier.
- Direct relevance to Prometheus.
- Known limitations.

Trust tiers:

- Tier 1: primary sources such as company filings, official product documentation, government databases, patent databases, academic papers, and official company announcements.
- Tier 2: reputable secondary sources such as established business publications, analyst summaries, and industry publications.
- Tier 3: directional sources such as startup databases, podcasts, conference talks, and social posts from identifiable operators.
- Excluded: unsupported scraped material, unverifiable reposts, anonymous claims, and sources that violate terms of use.

### 3. Classification Layer

Purpose: make research searchable and reusable.

Primary categories:

- AI
- Competition
- Funding
- Sales
- Industries
- Technology
- Customer Pain Points
- Enterprise
- Regulations
- Opportunities
- Risks

Industry lenses:

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
- Fitness and gyms as the validation wedge.

### 4. Synthesis Layer

Purpose: convert evidence into decisions and questions.

Required synthesis distinctions:

- Verified facts: directly supported by cited evidence.
- Hypotheses: plausible interpretations requiring validation.
- Implications: what the fact or hypothesis could mean for Prometheus.
- Actions: research-only next steps or proposed handoffs.

Research briefs should answer:

- What changed externally?
- Why does it matter for outside sales organizations?
- Which industries are affected?
- Does this strengthen or weaken Prometheus' thesis?
- What should the founder know now?
- What should engineering avoid until evidence improves?
- Which subsystem might need a future handoff?

### 5. Handoff Layer

Purpose: move mature intelligence to the right subsystem without bypassing boundaries.

Approved future handoff targets:

- Companion: founder-facing intelligence summaries after approval.
- Founder Dashboard: internal strategic brief views after approval.
- Website: selected public insights after marketing approval.
- Social Media: selected publishable insights after brand approval.
- Intelligence Engine: structured learning inputs after explicit engineering approval.

Handoff constraints:

- Research handoffs are advisory.
- A receiving subsystem must accept and implement any production change.
- Research must not directly modify Dashboard, Companion, CRM, Infrastructure, Website, or Intelligence Engine.
- Research must not write production data, mutate runtime configuration, or change customer-facing behavior.
- Research must preserve source attribution and confidence level through handoff.

## Founder Intelligence Brief Workflow

1. Select recurring window: daily, weekly, monthly, or event-triggered.
2. Pull candidate items from approved source types.
3. Record each source in the evidence ledger.
4. Classify each item by category, industry, source tier, and confidence.
5. Separate verified facts from hypotheses.
6. Summarize strategic implications for Prometheus.
7. Create future subsystem handoff recommendations only when justified.
8. Run the Research validation gate.
9. Store the brief under a dated Research brief location.

## Strategic Briefing System

Founder Strategic Intelligence Briefing System v1 extends this foundation with recurring executive brief products:

- Daily Founder Brief.
- Weekly AI Brief.
- Weekly Competitor Brief.
- Weekly Startup Funding Brief.
- Weekly Outside Sales Brief.
- Weekly Industry Brief.
- Weekly Healthcare Brief.
- Weekly Enterprise Technology Brief.
- Weekly Customer Pain Point Brief.
- Monthly Strategic Review.

Every strategic briefing must include Summary, Why it matters, Impact on Prometheus, Opportunities, Risks, Recommended founder actions, and Source references.

The briefing system is defined by:

- `research/briefing-system.md`
- `research/registers/briefing-catalog.json`
- `research/schemas/strategic-intelligence-brief.schema.json`
- `research/templates/strategic-intelligence-brief.md`
- `research/future-briefing-handoffs.md`

## Duplicate Prevention

Existing research-related documents must be reused:

- `docs/competitor-research.md`
- `docs/competitor-pricing-revenue.md`
- `docs/prometheus-iq-competitive-differentiation.md`
- `RESEARCH_FOUNDATION.md`
- `COMPANY_IDENTITY.md`
- `docs/product-vision.md`
- `docs/prometheus-company-manual.md`
- `research/briefing-system.md`
- `research/registers/briefing-catalog.json`

Do not create replacement competitive-positioning documents when an update to the existing Research structure or existing docs is sufficient.

## Non-Goals For v1

- No live integrations.
- No automated web scraping.
- No production dashboard views.
- No Companion memory writes.
- No CRM data access.
- No Intelligence Engine training.
- No Intelligence Engine evidence writes.
- No public publishing pipeline.
- No private customer-data ingestion.
