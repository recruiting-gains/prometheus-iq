# Founder Strategic Intelligence Briefing System v1

Subsystem: Prometheus Research

## Purpose

The Founder Strategic Intelligence Briefing System turns Research Foundation v1 into a recurring executive intelligence system. It gives Prometheus a repeatable way to monitor external change, synthesize evidence, and prepare founder-level action without modifying production systems.

Research is the primary external intelligence provider for Prometheus. It supplies sourced context and strategic signals. It does not own production recommendations, customer data, CRM records, Dashboard behavior, public publishing, or Companion behavior.

## Briefing Products

The system owns ten recurring brief products:

1. Daily Founder Brief.
2. Weekly AI Brief.
3. Weekly Competitor Brief.
4. Weekly Startup Funding Brief.
5. Weekly Outside Sales Brief.
6. Weekly Industry Brief.
7. Weekly Healthcare Brief.
8. Weekly Enterprise Technology Brief.
9. Weekly Customer Pain Point Brief.
10. Monthly Strategic Review.

The canonical machine-readable catalog is `research/registers/briefing-catalog.json`.

## Required Brief Sections

Every briefing must include:

- Summary.
- Why it matters.
- Impact on Prometheus.
- Opportunities.
- Risks.
- Recommended founder actions.
- Source references.

Briefs may add optional sections, but these required sections cannot be omitted.

## Operating Loop

1. Select the briefing product and reporting window.
2. Gather candidate intelligence from approved source types.
3. Reject unsupported scraped, private, leaked, or unattributable material.
4. Record source references with trust tier and limitations.
5. Separate verified facts from hypotheses.
6. Summarize why the development matters for outside-sales organizations.
7. State the impact on Prometheus using the company identity and product vision.
8. Identify opportunities, risks, and founder actions.
9. Prepare future handoff recommendations only when evidence justifies them.
10. Run `npm run test:core`.

## Relationship To Adaptive Intelligence

The Adaptive Outside Sales Intelligence Engine is the long-term intelligence brain for production learning and recommendations. Research briefings can become contextual evidence only through an approved Intelligence Engine handoff.

Research briefings must not:

- Change route scoring.
- Change recommendation confidence.
- Promote patterns.
- Write knowledge graph facts.
- Modify production Dashboard, CRM, Companion, Website, Infrastructure, Data, or Intelligence Engine behavior.

Research briefings may prepare:

- Sourced industry intelligence.
- Competitive intelligence.
- Market changes.
- External risk signals.
- Founder action recommendations.
- Approved handoff candidates for future subsystem work.

## Source Discipline

Research briefings must follow `research/source-policy.md`.

Preferred source types:

- Official company announcements and product documentation.
- Government, regulatory, and patent sources.
- SEC and official funding filings where available.
- Reputable business, technology, and trade publications.
- Academic and technical research.
- Existing Prometheus internal strategy documents when marked as internal context.

Briefings must label:

- Verified facts.
- Hypotheses.
- Unknowns.
- Founder assumptions.

## Future Handoff Targets

Prepared future handoffs:

- Companion: founder-safe briefing summaries after approval.
- Intelligence Engine: sourced contextual evidence after approved contract admission.
- Website: public-insight candidates after brand and marketing approval.
- Sales: competitive, customer pain, industry, and objection intelligence after Sales acceptance.

Handoff details are defined in `research/future-briefing-handoffs.md`.

## Non-Goals

- No live source ingestion.
- No automated scraping.
- No production integrations.
- No public publishing.
- No Companion memory writes.
- No Intelligence Engine evidence writes.
- No CRM or Dashboard data access.
- No private customer-data ingestion.
