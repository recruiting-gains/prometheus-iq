# Prometheus Social Media

## Purpose

The repository Social Media subsystem owns technical Instagram runtime controls,
provider and security contracts, normalized analytics, Founder reporting, UTM and
Website attribution, CRM attribution, and approved-claims boundaries.

Meta AI owns ordinary Instagram, Facebook, LinkedIn, and other social content
creation and social push outside this repository. The repository does not own a
campaign calendar, content-production schedule, campaign-planning system, or
manual social-push operating system.

## Technical Surface

- `contracts/social-media-contract.js`: normalized analytics and attribution contract.
- `providers/social-provider-registry.js`: supported provider registry.
- `providers/instagram-business-provider.js`: backend-only Instagram analytics adapter.
- `infrastructure/instagram-runtime-controls.js`: backend-only secret and runtime checks.
- `infrastructure/meta-instagram-oauth-workflow.js`: OAuth connection and token lifecycle.
- `social-media-analytics-service.js`: normalized analytics snapshot service.
- `reporting/founder-instagram-analytics-reporting-view.js`: read-only Founder report.
- `docs/meta-instagram-setup.md`: external Meta setup and permission requirements.

The read-only production report route is `GET /api/social/instagram/report`. It
does not expose tokens, publish content, send messages, automate comments, scrape,
or mutate Website or CRM attribution.

## Hard Rules

- Use supported provider APIs only; no scraping or password login.
- Keep tokens and credentials backend-only.
- Never report sample analytics as live analytics.
- No repository-owned posting, messaging, comment, campaign-calendar, or content-schedule operation.
- No browser automation for social account actions.
- Do not call Meta unless the Instagram runtime state is `connected`.

Founder-attended Reddit assistance is research-only: a Founder starts each
session, selects the discussion or bounded search, and receives at most five
advisory talking points with community-rule, affiliation, promotion, disclosure,
and claims-risk review. The repository stores no Reddit login and performs no
posting, commenting, replying, voting, following, messaging, scheduling,
monitoring, quota, or unattended account action.

## Verification

```bash
npm run test:security
npm run test:public
npm run overwatch:artifact-contracts:check
npm run security:check
npm run build
```
