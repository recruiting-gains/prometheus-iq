# Prometheus System Map

Purpose: define the permanent Prometheus workstreams so future engineering, product, sales, research, and operations work can be routed into the correct area without creating duplicate systems.

This document is a reference map only. It does not move folders, redesign architecture, replace existing systems, or change product behavior.

## Governing Rule

Every future Prometheus task should identify its primary workstream before work begins. If a request touches multiple workstreams, the session should name the boundaries clearly and avoid mixing unrelated changes in one commit.

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

Scope: future customer and lead communication workflows.

Areas:

- Calls
- SMS
- Email
- Contacts
- Follow-up
- Tasks
- Calendar

Primary rule: do not connect external communication systems or send messages without explicit Cruz approval.

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

Scope: sales enablement, demos, pilots, feedback, and investor/customer communication.

Areas:

- Demo Preparation
- Investor Pitch
- Customer Feedback
- Beta Testing
- Feature Requests
- Sales Scripts

Primary rule: sales artifacts should be send-ready, accurate, and separated from internal-only Founder Companion files.

### 12. Prometheus Research

Scope: future strategy, ideas, competitive research, patents, and architecture exploration.

Areas:

- Competitive Analysis
- AI Research
- Product Ideas
- Future Features
- Patents
- Architecture

Primary rule: research should be labeled as research. Do not treat research ideas as implemented features or production commitments.

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
