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

## Market Intelligence Engine

Market Intelligence Engine v1 extends Research into strategic market expansion recommendations.

Capabilities:

- Market opportunity scoring.
- Industry attractiveness analysis.
- Outside-sales market ranking.
- Competitor movement tracking.
- AI trend tracking.
- Partnership opportunities.
- Geographic expansion opportunities.
- Enterprise target identification.

The engine is defined by:

- `research/market-intelligence-engine.md`
- `research/registers/market-intelligence-model.json`
- `research/schemas/market-intelligence-recommendation.schema.json`
- `research/templates/market-expansion-recommendation.md`

Market Intelligence Engine v1 is not a runtime service. It must not modify Companion, Dashboard, CRM, Mobile, Intelligence runtime, Website runtime, Infrastructure, or production data.

## Executive Intelligence Platform

Executive Intelligence Platform v1 establishes the active Research standard for high-impact executive conversation preparation.

Research no longer treats dossiers as the primary future output. Research now produces Executive Intelligence Packages that answer:

What would a Fortune 100 Corporate Development team want to know before making an important strategic decision involving this business?

Research produces Executive Intelligence Packages as complete operational intelligence briefings for executive decision readiness.

Every Executive Intelligence Package must prepare decision-makers by reducing uncertainty through lawful, attributable evidence. Research prepares executives. Dashboard displays. CRM tracks. Intelligence interprets. Overwatch governs.

Every Executive Intelligence Package must be written from the perspective of the executive receiving the package unless the workspace explicitly defines Prometheus as the decision-maker or operator. Default package language prepares executive decision readiness and must not imply Prometheus executes outreach, conversation, negotiation, qualification, or final decision ownership.

Required package layers:

1. Executive Summary.
2. Business Identity.
3. Ownership, Leadership, Public Operators, Corporate Structure, Timeline.
4. Business Evolution, Expansion, Growth, Brand Development, Historical Milestones.
5. Operational Intelligence.
6. Commercial Ecosystem Intelligence.
7. Competitive Intelligence.
8. Community Intelligence.
9. Digital Intelligence.
10. Reputation Intelligence.
11. Strategic Intelligence.
12. Executive Decision Support.

Required evidence labels:

- Observed.
- Corroborated.
- Owner-provided.
- Unknown.
- Inference.

Every recommendation and major conclusion must include evidence basis, source reliability, confidence level, verification needed, and business decision impact.

The platform is defined by:

- `research/executive-intelligence-platform.md`
- `research/registers/executive-intelligence-package-standard.json`
- `research/schemas/executive-intelligence-package.schema.json`
- `research/templates/executive-intelligence-package.md`
- `research/reports/executive-intelligence-benchmark-study-v1.md`
- `research/reports/executive-intelligence-benchmark-study-v1.json`

Executive Intelligence Benchmark Study v1 establishes the Prometheus methodology benchmark. It analyzes public decision-support patterns from McKinsey & Company, Bain & Company, Boston Consulting Group, Deloitte Strategy, corporate development teams, private equity due diligence teams, investment banking M&A advisory teams, and strategic consulting firms.

The benchmark question is:

What makes executives trust recommendations?

Benchmark-derived Prometheus methodology:

- Decision framing.
- Decision thesis.
- Issue tree.
- Evidence map.
- Value and risk driver map.
- Alternatives and opportunity cost.
- Scenario and decision tree.
- Unknown value ranking.
- Red-team review.
- Executive brief and appendices.

Cross-industry validation is provided by:

- `research/fixtures/cross-industry-research-fixture-v1.json`

The fixture is explicitly synthetic and non-production. It proves that the
same Research standards can represent multiple industries while preserving
workspace isolation, evidence provenance, confidence requirements, and
production boundaries. Customer-specific Research workspaces are not part of
the current deployable tree; repository history remains the audit archive for
retired Research artifacts.

Existing Executive Due Diligence Dossiers remain historical Research artifacts and current Dashboard inputs until a future approved Dashboard handoff migrates consumers to Executive Intelligence Packages. New Research work must create Executive Intelligence Packages and package registers instead of new dossier artifacts as the primary output.

Executive Intelligence Platform v1 is a Research standard only. It must not modify Dashboard, Companion, CRM, Mobile, Intelligence runtime, Website runtime, Infrastructure, Fitness Connection, Route Intelligence, Active Pool, production data, or customer-facing behavior.

## Gaia Research Orchestrator Foundation v1

Gaia is the Prometheus Research Evidence Orchestrator. Gaia does not replace external GPTs, connectors, plugins, databases, or research tools. Gaia orchestrates them.

External GPTs and providers are evidence providers only. Gaia remains the executive intelligence engine.

Future research requests may utilize Apollo, Marketing Research GPT, Consensus, SciSpace, AskYourPDF, Public Web Research, CRM through future approved Research-safe handoff, and future approved evidence providers.

Every evidence source is replaceable. If a superior research provider exists tomorrow, Gaia can replace the old provider without changing evidence normalization, provenance tracking, duplicate detection, conflict resolution, confidence assignment, unknown identification, evidence quality scoring, or Executive Intelligence synthesis.

Gaia Evidence Engine responsibilities:

- Collect evidence.
- Normalize evidence.
- Remove duplicate findings.
- Resolve conflicting evidence.
- Track evidence provenance.
- Assign confidence.
- Identify unknowns.
- Score evidence quality.
- Forward validated evidence into Executive Intelligence.

External GPTs never produce executive recommendations. External GPTs provide evidence. Gaia validates. Gaia scores. Gaia organizes. Gaia produces Executive Intelligence. Gaia recommends.

The Gaia Research Orchestrator is defined by:

- `research/gaia-research-orchestrator.md`
- `research/registers/gaia-evidence-engine.json`
- `research/schemas/gaia-evidence-item.schema.json`

Gaia Research Orchestrator Foundation v1 is architecture only. It does not generate Executive Intelligence Packages and does not modify Route IQ, Athena, Dashboard, Infrastructure, Website, CRM, Companion, Mobile, Fitness Connection, Intelligence runtime, or production data.

## Apollo Enrichment Standard For Franchise Target Research

Apollo is permitted as a Research enrichment source when future franchise-development target lists need lead, contact, company, operator, title, company-size, location, industry, persona, or multi-location operator discovery.

Apollo may support Houston-area franchise operator, restaurant group owner, multi-location business owner, fitness founder, wellness founder, supplement/nutrition retail owner, food and beverage operator, consumer health executive, private investor with operating background, and expansion-signal business owner discovery.

Apollo is not a source of truth. Apollo-derived findings must be labeled as enrichment signals unless corroborated by lawful public sources or owner-provided evidence. Apollo alone must not support final ownership, control, authority, capital readiness, franchise-fit, qualification probability, or Executive Intelligence conclusions.

Future franchise target lists must document whether Apollo was used. If Apollo was not used, Research must explain why.

Operating rule:

- Apollo = lead/contact/company enrichment source.
- Research = verification, scoring, qualification probability, and Executive Intelligence Package creation.

## Duplicate Prevention

Existing research-related documents must be reused:

- `docs/competitor-research.md`
- `docs/competitor-pricing-revenue.md`
- `docs/prometheus-iq-competitive-differentiation.md`
- `RESEARCH_FOUNDATION.md`
- `PRODUCT_VISION.md`
- `README.md`
- `research/briefing-system.md`
- `research/market-intelligence-engine.md`
- `research/executive-intelligence-platform.md`
- `research/registers/briefing-catalog.json`
- `research/registers/market-intelligence-model.json`
- `research/registers/executive-intelligence-package-standard.json`

Do not create replacement competitive-positioning documents when an update to the existing Research structure or existing docs is sufficient.

## Non-Goals For v1

- No live integrations.
- No automated web scraping.
- No production dashboard views.
- No Companion memory writes.
- No CRM data access.
- No Intelligence Engine training.
- No Intelligence Engine evidence writes.
- No Market Intelligence runtime service.
- No Executive Intelligence Package production runtime service.
- No public publishing pipeline.
- No private customer-data ingestion.
