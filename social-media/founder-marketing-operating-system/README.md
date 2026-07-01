# Founder Marketing Operating System v1

Owner: Prometheus Social Media
Status: Implementation and architecture foundation
Production integrations: none
Live posting: disabled
Live Meta APIs: not connected

## Purpose

The Founder Marketing Operating System gives Prometheus a reusable way to plan, create, publish manually, measure, and improve founder-led marketing without changing Anthony's beta, Website, Dashboard, CRM, Infrastructure, or live provider integrations.

The system turns founder knowledge into a repeatable weekly marketing loop:

1. Capture field reality and company lessons.
2. Turn those lessons into platform-specific content.
3. Publish manually from approved accounts.
4. Track performance with clearly labeled manual or sample metrics.
5. Feed validated learning into future Website and CRM attribution contracts.

## Source Of Truth

This folder owns founder marketing operations:

- `founder-marketing-operating-system.v1.json`
- `content-calendar.md`
- `founder-content-workflow.md`
- `platform-strategy-and-cadence.md`
- `campaign-kpi-attribution-framework.md`
- `brand-and-growth-strategy.md`
- `templates/campaign-brief.template.md`

## Operating Principles

- Field reality over abstract thought leadership.
- Founder perspective, not corporate filler.
- Outside sales intelligence, not gym-specific positioning.
- Proof without surveillance.
- Manual publishing until approved integrations exist.
- Manual or sample analytics only until live providers are connected.
- Website and CRM attribution are planned as contracts, not implemented here.

## Weekly Operating Loop

Monday:

- Choose weekly theme, campaign, and proof point.
- Draft one flagship founder post.
- Select two short-form clips or text ideas from field notes.

Tuesday:

- Publish one practical field-sales lesson.
- Capture comments, objections, and questions manually.

Wednesday:

- Publish one founder build-in-public update.
- Convert one product or sales lesson into LinkedIn/X text.

Thursday:

- Publish one product education post or short video.
- Review campaign KPI sheet manually.

Friday:

- Publish weekly recap.
- Identify top learning and next week's angle.

Weekend:

- Optional lightweight founder reflection.
- No required posting.

## Non-Goals

- No production OAuth.
- No live Meta API connection.
- No browser automation.
- No scraping.
- No automated posting.
- No Anthony beta changes.
- No Website, Dashboard, or CRM changes.

## Validation

Run:

```bash
npm run test:social-media
```
