# Prometheus Social Media

## Purpose

Prometheus Social Media owns marketing systems, social media architecture, social analytics, attribution, campaign planning, and public brand intelligence.

This subsystem connects marketing activity to:

- Instagram Business analytics.
- Website attribution.
- CRM attribution.
- Beta attribution.
- Founder marketing analytics.
- Campaign performance reporting.

## Current Status

Social Media / Marketing Analytics Architecture v1 is implemented as a provider-neutral foundation with Instagram Business as the first concrete provider adapter.

Live provider calls pass through the verified Instagram runtime controls. Meta Graph API reads are blocked unless backend setup, token, permissions, and verification metadata are all present. When connected, the Instagram provider consumes account/profile data, account insights, and available content-level insights without enabling posting, DMs, comment automation, scraping, or token exposure.

## Source Files

- `contracts/social-media-contract.js`: official Social Media analytics and attribution contract.
- `providers/social-provider-registry.js`: supported provider registry for Instagram, Facebook, LinkedIn, X, TikTok, and YouTube.
- `providers/instagram-business-provider.js`: backend-only Instagram Business analytics provider adapter.
- `infrastructure/instagram-runtime-controls.js`: backend-only Instagram/Meta secret and runtime state validation.
- `infrastructure/meta-instagram-oauth-workflow.js`: backend-only Meta Instagram OAuth connection, long-lived token exchange, token verification, and refresh workflow.
- `social-media-analytics-service.js`: normalized marketing analytics snapshot service.
- `samples/marketing-analytics.sample.json`: explicit mock/sample analytics fixture.
- `docs/social-media-marketing-analytics-architecture-v1.md`: architecture and subsystem contracts.
- `docs/meta-instagram-setup.md`: required Meta app setup, scopes, permissions, and external configuration.

## Hard Rules

- Do not implement scraping.
- Do not automate browsers.
- Do not store social account passwords.
- Do not put tokens in frontend code.
- Do not implement live posting.
- Do not report mock/sample analytics as live analytics.
- Keep secrets backend-only through environment variables or Infrastructure-owned secret storage.
- Do not configure non-Instagram providers until their owning subsystem explicitly requests that work.
- Do not call Meta unless the Instagram runtime state is `connected`.
- Do not enable posting, messaging, DMs, comment automation, browser automation, or password storage through the OAuth workflow.

## Instagram Runtime States

- `not_configured`
- `configured`
- `permission_required`
- `token_missing`
- `token_expired`
- `verification_pending`
- `connected`
- `error`

## Contract Consumers

Website, CRM, Dashboard or beta intake, Founder analytics, Integrations, and Infrastructure should consume the Social Media contracts instead of rebuilding provider or attribution logic.

## Verification

```bash
npm run test:social-media
npm run security:check
npm run build
```
