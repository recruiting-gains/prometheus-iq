# Prometheus System Map

Purpose: define the permanent Prometheus workstreams so future engineering, product, sales, research, and operations work can be routed into the correct area without creating duplicate systems.

This document is a reference map only. It does not move folders, redesign architecture, replace existing systems, or change product behavior.

## Governing Rule

Every future Prometheus task should identify its primary workstream before work begins. If a request touches multiple workstreams, the session should name the boundaries clearly and avoid mixing unrelated changes in one commit.

## Governing Identity Sources

- `COMPANY_IDENTITY.md`: canonical company mission, vision, values, positioning, and permanent company identity decisions.
- `docs/product-vision.md`: product vision and long-term product direction.
- `docs/prometheus-company-manual.md`: company operating context and certified company milestones.

## Workstreams

### 1. Prometheus Dashboard

Scope: the Prometheus IQ product surface used by Founder, Owner, and Representative users.

Areas:

- Founder
- Rep
- Route Intelligence
- Territory Intelligence
- Discovery Mode
- UI / UX
- PWA
- Release Pipeline
- Production Support

Primary rule: improve the existing dashboard. Do not create duplicate dashboards, duplicate route cards, or replacement apps unless Cruz explicitly approves.

### 2. Prometheus Companion

Scope: Cruz's private Founder Operating System and local AI companion.

Areas:

- Voice
- Conversation
- Memory
- Personality
- Diagnostics
- AI Behavior

Primary rule: Companion is founder-only. Do not confuse Companion work with the public website, Anthony beta, or production Prometheus IQ dashboard work.

### 3. Prometheus Intelligence Engine

Scope: the reasoning and recommendation layer behind Prometheus.

Areas:

- Learning Engine
- Recommendation Engine
- Scoring
- Bullseye Territory
- Discovery Logic
- Analytics

Primary rule: improve the existing intelligence architecture. Do not create a second learning engine, second recommendation system, or disconnected scoring model.

### 4. Prometheus Infrastructure

Scope: deployment, authentication, security, source control, and operational reliability.

Areas:

- Cloudflare
- Wrangler
- GitHub
- Security
- Authentication
- Deployment
- Monitoring

Primary rule: infrastructure changes must protect production, avoid secrets exposure, and preserve recoverability.

### 5. Prometheus CRM

Scope: customer/account system of record, lead and contact lifecycle, follow-up/task queues, beta and pilot account tracking, enterprise opportunity pipeline, customer onboarding, customer success tracking, expansion, renewal, executive relationships, account health, and account timeline.

Areas:

- Company accounts
- Contacts
- Decision makers
- Leads
- Pilot companies
- Beta companies
- Enterprise opportunities
- Customer onboarding
- Customer success
- Expansion opportunities
- Renewal lifecycle
- Executive relationships
- Customer health scoring
- Account timeline
- Meeting history
- Product adoption snapshots
- Success milestones
- Multi-location account hierarchy
- Follow-up
- Tasks
- Calendar

Primary rule: CRM owns the internal account/customer lifecycle model but must not duplicate Dashboard UI/runtime logic, Companion behavior, Infrastructure/auth/storage, Data route/prospect governance, Intelligence Engine scoring, or Sales-owned go-to-market narrative. Do not connect external communication systems or send messages without explicit Cruz approval.

### 6. Prometheus Data

Scope: data sources, verified prospect pools, imports, exports, sync, and data quality.

Areas:

- Google Places
- Qualified Prospects
- Route Pools
- Imports
- Exports
- Data Quality
- Sync

Primary rule: verified field data and Google-qualified data must remain trustworthy. Do not invent businesses, weaken validation gates, or expose API keys.

### 7. Prometheus Website

Scope: public-facing PrometheusRouteIQ / Prometheus IQ web presence.

Areas:

- Landing Page
- Investor Portal
- Documentation
- Pricing
- Blog
- Support

Primary rule: website work is separate from the Prometheus IQ dashboard and Companion unless explicitly linked by the task.

### 8. Prometheus Mobile

Scope: phone and device behavior for Prometheus IQ and related experiences.

Areas:

- iPhone
- Android
- Offline Mode
- Notifications
- Device Testing

Primary rule: mobile work should verify the real device experience, especially PWA launch behavior, authentication, caching, and route usability.

### 9. Prometheus Integrations

Scope: third-party services connected to Prometheus.

Areas:

- Google Maps
- Google Places
- Cloudflare
- Twilio
- Gmail
- Calendar
- Future APIs

Primary rule: integrations must be backend-safe where required, never expose secrets, and should be added only when the existing architecture is ready to receive them.

### 10. Prometheus Social Media

Scope: brand presence, social content planning, and future social analytics.

Areas:

- Instagram
- LinkedIn
- Facebook
- TikTok
- Canva
- Content Calendar

Primary rule: social media integrations must not store passwords, expose tokens, or pretend live analytics exist before the API is connected.

### 11. Prometheus Sales

Scope: go-to-market strategy, enterprise sales process, industry positioning, pilots, demos, customer acquisition, customer success workflow, expansion, renewal, and sales enablement for organizations that rely on outside sales representatives.

Areas:

- Go-To-Market Strategy
- Enterprise Sales Methodology
- Discovery
- Qualification
- Demo Preparation
- Pilot Program Structure
- Customer Onboarding
- Customer Success Workflow
- Objection Handling
- ROI And Business Case
- Industry Positioning
- Investor Pitch
- Customer Feedback
- Beta Testing
- Feature Requests
- Sales Scripts

Primary rule: Sales owns reusable go-to-market systems and customer-facing sales documentation. Sales does not own Dashboard, Companion, CRM implementation, Infrastructure, Integrations, or Intelligence Engine implementation. Sales artifacts should be accurate, send-ready when marked sendable, and separated from internal-only Founder Companion files.

Current foundation:

- `sales/README.md`
- `sales/enterprise-sales-methodology.md`
- `sales/discovery-and-qualification.md`
- `sales/demo-pilot-onboarding.md`
- `sales/customer-success-lifecycle.md`
- `sales/objection-library.md`
- `sales/roi-calculator-framework.md`
- `sales/industry-positioning.md`
- `sales/founder-pitch-and-executive-presentation.md`
- `sales/documentation-architecture.md`

### 12. Prometheus Research

Scope: strategic intelligence, future strategy, ideas, competitive research, patents, market monitoring, and architecture exploration.

Areas:

- Competitive Analysis
- AI Research
- Founder Intelligence Briefs
- Startup Funding
- Outside Sales Best Practices
- Industry Research
- Regulation Watch
- Product Ideas
- Future Features
- Patents
- Architecture

Primary rule: research should be labeled as research. Do not treat research ideas as implemented features or production commitments. Research must not directly modify Dashboard, Companion, CRM, Infrastructure, Website, or Intelligence Engine; future integrations require approved subsystem handoffs.

Current foundation:

- `research/README.md`
- `research/architecture.md`
- `research/source-policy.md`
- `research/templates/founder-intelligence-brief.md`
- `research/schemas/founder-intelligence-brief.schema.json`
- `research/taxonomy/research-taxonomy.json`
- `research/registers/source-register.json`
- `research/registers/intelligence-backlog.json`

## Workstream Routing Checklist

Before beginning future work, answer:

1. Which workstream is primary?
2. Which workstreams are touched secondarily?
3. What existing files or systems already cover this area?
4. What must not be duplicated?
5. Does the work affect production, Companion, Anthony beta, the public website, or infrastructure?
6. Is this code, documentation, release work, research, or sales material?
7. What verification proves the work is actually complete?

## Commit Guidance

Prefer separate commits by workstream. Avoid mixing unrelated changes such as Dashboard UI, Companion behavior, Cloudflare configuration, social media planning, and sales documents in one commit.

## Final Rule

Prometheus should operate as one company and one ecosystem, but engineering work should remain clearly separated by workstream so progress stays organized, recoverable, and easy to verify.
