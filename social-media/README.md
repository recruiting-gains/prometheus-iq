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

Live provider calls are intentionally not enabled by default. When Meta credentials are missing, the subsystem returns clearly labeled mock/sample analytics and disconnected provider status.

## Source Files

- `contracts/social-media-contract.js`: official Social Media analytics and attribution contract.
- `providers/social-provider-registry.js`: supported provider registry for Instagram, Facebook, LinkedIn, X, TikTok, and YouTube.
- `providers/instagram-business-provider.js`: backend-only Instagram Business analytics provider adapter.
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

## Contract Consumers

Website, CRM, Dashboard or beta intake, Founder analytics, Integrations, and Infrastructure should consume the Social Media contracts instead of rebuilding provider or attribution logic.

## Verification

```bash
npm run test:social-media
npm run security:check
npm run build
```
