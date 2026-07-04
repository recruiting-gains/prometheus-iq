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
- `briefing-system.md`: Recurring executive intelligence system for founder briefings.
- `market-intelligence-engine.md`: Research-owned market expansion scoring and ranking architecture.
- `future-briefing-handoffs.md`: Future handoff rules for Companion, Intelligence Engine, Website, and Sales.
- `schemas/founder-intelligence-brief.schema.json`: Machine-readable Founder Intelligence Brief contract.
- `schemas/strategic-intelligence-brief.schema.json`: Machine-readable recurring strategic brief contract.
- `schemas/market-intelligence-recommendation.schema.json`: Machine-readable market expansion recommendation contract.
- `templates/founder-intelligence-brief.md`: Recurring brief template.
- `templates/strategic-intelligence-brief.md`: Shared template for recurring executive intelligence products.
- `templates/market-expansion-recommendation.md`: Founder-ready market expansion recommendation template.
- `taxonomy/research-taxonomy.json`: Core categories, industries, intelligence questions, and future handoff targets.
- `registers/source-register.json`: Initial approved-source registry.
- `registers/intelligence-backlog.json`: Initial recurring watchlist and open research backlog.
- `registers/briefing-catalog.json`: Recurring briefing product catalog.
- `registers/market-intelligence-model.json`: Market opportunity scoring model, candidate universe, and protected subsystem gates.
- `reports/market-expansion-recommendation-v1.md`: First founder-ready strategic market expansion recommendation.
- `reports/market-expansion-scoring-v1.json`: Structured scoring ledger for Market Expansion Recommendation v1.
- `workspaces/smoothie-depot/business-prospect-discovery-workflow-v1.md`: Smoothie Depot public business prospect discovery workflow.
- `workspaces/smoothie-depot/executive-due-diligence-intelligence-standard-v4.md`: Smoothie Depot executive due diligence intelligence standard.
- `workspaces/smoothie-depot/executive-due-diligence-framework-v4.json`: Machine-readable evidence, confidence, contradiction, decision tree, and decision journal framework.
- `workspaces/smoothie-depot/ranked-business-prospects-2026-07-03.md`: First founder-ready Smoothie Depot ranked prospect list.
- `workspaces/smoothie-depot/ranked-business-prospects-2026-07-03.json`: Structured Smoothie Depot prospect scoring ledger.

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

Current founder-ready output:

- First recommended expansion market: Roofing.
- Top 10 expansion opportunities: Roofing, Solar, HVAC, Pest Control, Home Services, Security, Medical, Insurance, Commercial Services, Telecommunications.
- Report: `research/reports/market-expansion-recommendation-v1.md`

## Smoothie Depot Business Prospect Discovery

Research owns Smoothie Depot Business Prospect Discovery v1 as a workspace-isolated research workflow for the daily founder question: "Who should I call today?"

Current founder-ready output:

- Top call targets: Nutrition Depot Houston and Greater Houston, Cranky Carrot Juice Co., LEEMOO Health Bar, Tight Squeeze Juice Bar, and HS Green.
- Report: `research/workspaces/smoothie-depot/ranked-business-prospects-2026-07-03.md`
- Structured ledger: `research/workspaces/smoothie-depot/ranked-business-prospects-2026-07-03.json`

This workflow uses lawful public business information only. It does not collect private financials, credit reports, bank information, tax records, or restricted-platform scraped data. It does not modify CRM, Dashboard, Website, Infrastructure, Companion, Mobile, Route Intelligence, Active Pool, Fitness Connection, or Intelligence Engine runtime.

Executive due diligence standard:

- Evidence labels: observed, inferred from multiple evidence sources, self-reported, owner-provided, unknown.
- Required challenge loops: supporting evidence, contradicting evidence, assumptions, confidence, falsification triggers, and unknowns.
- Required analysis: second-order implications, third-order recommendation effects, opportunity cost, alternative hypotheses, red-team review, unknown-value ranking, scenario decision tree, decision confidence matrix, and post-meeting decision journal.

## Boundary

Research can produce structured intelligence for future consumption by Companion, Founder Dashboard, Website, Social Media, Sales, and Intelligence Engine only after an explicit approved handoff. This foundation does not implement those integrations.
