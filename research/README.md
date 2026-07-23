# Prometheus Research

Purpose: operate as Prometheus' strategic intelligence division.

Prometheus Research produces verified intelligence for founders, engineering, product strategy, sales, marketing, and future AI decision making. It is not a production subsystem and must not modify Dashboard, Companion, CRM, Infrastructure, Website, or Intelligence Engine behavior directly.

## Mission

Research tracks external developments that can affect Prometheus as an AI operating system for outside sales organizations.

Prometheus IQ is not a gym sales platform. Gym sales is the first production validation environment. Research must evaluate opportunities horizontally across industries that depend on field representatives, canvassers, territory reps, local outreach teams, and route-based selling.

## Operating Rules

- Use trustworthy, attributable sources.
- Never scrape unsupported sources.
- Clearly distinguish verified facts from hypotheses.
- Maintain source citations where appropriate.
- Never modify production data.
- Never modify Dashboard, Companion, CRM, Infrastructure, Website, or Intelligence Engine directly.
- Treat research outputs as advisory until an approved subsystem handoff accepts implementation work.

## Foundation Files

- `architecture.md`: Research operating architecture, workflows, boundaries, and handoff model.
- `source-policy.md`: Source trust tiers, attribution requirements, and prohibited sourcing behavior.
- `gaia-research-orchestrator.md`: Gaia Research Orchestrator and Evidence Engine architecture.
- `executive-intelligence-platform.md`: Active Executive Intelligence Platform v1 standard for Research-owned Executive Intelligence Packages.
- `briefing-system.md`: Recurring executive intelligence system for founder briefings.
- `market-intelligence-engine.md`: Research-owned market expansion scoring and ranking architecture.
- `future-briefing-handoffs.md`: Future handoff rules for Companion, Intelligence Engine, Website, and Sales.
- `schemas/founder-intelligence-brief.schema.json`: Machine-readable Founder Intelligence Brief contract.
- `schemas/strategic-intelligence-brief.schema.json`: Machine-readable recurring strategic brief contract.
- `schemas/market-intelligence-recommendation.schema.json`: Machine-readable market expansion recommendation contract.
- `schemas/executive-intelligence-package.schema.json`: Machine-readable Executive Intelligence Package contract.
- `schemas/gaia-evidence-item.schema.json`: Machine-readable Gaia evidence item contract.
- `templates/founder-intelligence-brief.md`: Recurring brief template.
- `templates/strategic-intelligence-brief.md`: Shared template for recurring executive intelligence products.
- `templates/market-expansion-recommendation.md`: Founder-ready market expansion recommendation template.
- `templates/executive-intelligence-package.md`: Executive Intelligence Package template.
- `taxonomy/research-taxonomy.json`: Core categories, industries, intelligence questions, and future handoff targets.
- `registers/source-register.json`: Initial approved-source registry.
- `registers/intelligence-backlog.json`: Initial recurring watchlist and open research backlog.
- `registers/gaia-evidence-engine.json`: Provider-agnostic Gaia evidence orchestration and evidence-quality model.
- `registers/briefing-catalog.json`: Recurring briefing product catalog.
- `registers/market-intelligence-model.json`: Market opportunity scoring model, candidate universe, and protected subsystem gates.
- `registers/executive-intelligence-package-standard.json`: Active Executive Intelligence Package layer, evidence, quality, and boundary standard.
- `reports/executive-intelligence-benchmark-study-v1.md`: Benchmark study of public executive decision-support methodologies.
- `reports/executive-intelligence-benchmark-study-v1.json`: Structured benchmark ledger and Prometheus methodology recommendation.
- `reports/market-expansion-recommendation-v1.md`: First founder-ready strategic market expansion recommendation.
- `reports/market-expansion-scoring-v1.json`: Structured scoring ledger for Market Expansion Recommendation v1.
- `fixtures/cross-industry-research-fixture-v1.json`: Synthetic, non-production proof that one Research standard supports distinct field-service and medical-distribution industries without customer-specific artifacts.

## Recurring Founder Intelligence Briefs

The recurring brief format is designed to support:

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

Each brief must separate verified facts, hypotheses, evidence, source citations, strategic implications, and future subsystem handoffs.

## Recurring Strategic Briefing System

Research owns these recurring executive intelligence products:

- Daily Founder Brief
- Weekly AI Brief
- Weekly Competitor Brief
- Weekly Startup Funding Brief
- Weekly Outside Sales Brief
- Weekly Industry Brief
- Weekly Healthcare Brief
- Weekly Enterprise Technology Brief
- Weekly Customer Pain Point Brief
- Monthly Strategic Review

Each briefing must include Summary, Why it matters, Impact on Prometheus, Opportunities, Risks, Recommended founder actions, and Source references.

## Market Intelligence Engine

Research owns Market Intelligence Engine v1 for strategic market expansion recommendations.

Capabilities:

- Market opportunity scoring
- Industry attractiveness analysis
- Outside-sales market ranking
- Competitor movement tracking
- AI trend tracking
- Partnership opportunities
- Geographic expansion opportunities
- Enterprise target identification

Market Intelligence Engine v1 is architecture and validation only. It does not score live markets, scrape sources, deploy runtime services, or modify production systems.

## Executive Intelligence Platform

Research owns Executive Intelligence Platform v1 as the active standard for high-impact executive conversation preparation.

Research no longer treats dossiers as the primary future output. New Research packages must be Executive Intelligence Packages that answer:

What would a Fortune 100 Corporate Development team want to know before making an important strategic decision involving this business?

Package layers:

- Executive Summary
- Business Identity
- Ownership, Leadership, Public Operators, Corporate Structure, Timeline
- Business Evolution, Expansion, Growth, Brand Development, Historical Milestones
- Operational Intelligence
- Commercial Ecosystem Intelligence
- Competitive Intelligence
- Community Intelligence
- Digital Intelligence
- Reputation Intelligence
- Strategic Intelligence
- Executive Decision Support

Evidence labels:

- Observed
- Corroborated
- Owner-provided
- Unknown
- Inference

Every recommendation and major conclusion must include evidence basis, source reliability, confidence level, verification needed, and business decision impact.

Audience perspective:

Every Executive Intelligence Package must be written from the perspective of the executive receiving the package unless the workspace explicitly defines Prometheus as the decision-maker or operator. Research prepares executive decision readiness; the receiving executive owns outreach, conversation, negotiation, qualification, and final decision.

Existing Executive Due Diligence Dossiers remain historical Research artifacts and current Dashboard inputs until a future Dashboard handoff migrates consumers to Executive Intelligence Packages. New Research work must use the Executive Intelligence Package standard.

## Gaia Research Orchestrator

Research owns Gaia Research Orchestrator Foundation v1 as the permanent provider-agnostic evidence architecture.

Gaia does not replace external GPTs, connectors, plugins, databases, or research tools. Gaia orchestrates them.

External providers are evidence providers only. Apollo, Marketing Research GPT, Consensus, SciSpace, AskYourPDF, Public Web Research, CRM through future approved handoff, and future approved evidence providers are interchangeable.

Gaia validates evidence, normalizes evidence, removes duplicate findings, resolves conflicting evidence, tracks provenance, assigns confidence, identifies unknowns, scores evidence quality, forwards validated evidence into Executive Intelligence, and produces executive recommendations.

External GPTs never produce executive recommendations. Gaia produces Executive Intelligence and recommendations after evidence passes Gaia validation.

Defined by:

- `research/gaia-research-orchestrator.md`
- `research/registers/gaia-evidence-engine.json`

Benchmark methodology:

- Report: `research/reports/executive-intelligence-benchmark-study-v1.md`
- Structured ledger: `research/reports/executive-intelligence-benchmark-study-v1.json`
- Benchmark question: What makes executives trust recommendations?
- Organizations analyzed: McKinsey & Company, Bain & Company, Boston Consulting Group, Deloitte Strategy, corporate development teams, private equity due diligence teams, investment banking M&A advisory teams, and strategic consulting firms.
- Prometheus methodology: decision framing, decision thesis, issue tree, evidence map, value and risk driver map, alternatives and opportunity cost, scenario and decision tree, unknown value ranking, red-team review, executive brief and appendices.

Current founder-ready output:

- First recommended expansion market: Roofing.
- Top 10 expansion opportunities: Roofing, Solar, HVAC, Pest Control, Home Services, Security, Medical, Insurance, Commercial Services, Telecommunications.
- Report: `research/reports/market-expansion-recommendation-v1.md`

## Cross-Industry Validation

Research standards are customer-neutral. The synthetic fixture at
`research/fixtures/cross-industry-research-fixture-v1.json` proves that the
same evidence, package, provenance, isolation, and boundary rules can describe
distinct field-service and medical-distribution research contexts.

The fixture:

- Contains no production, customer, credential, contact, or location data.
- Uses clearly synthetic company and workspace identities.
- Keeps each workspace's evidence and conclusions isolated.
- Exercises one common Executive Intelligence Package standard.
- Confirms that Research remains advisory and changes no runtime subsystem.
- Must never become a production catalog, customer record, or recommendation input.

## Boundary

Research can produce structured intelligence for future consumption by Companion, Founder Dashboard, Website, Social Media, Sales, and Intelligence Engine only after an explicit approved handoff. This foundation does not implement those integrations.
