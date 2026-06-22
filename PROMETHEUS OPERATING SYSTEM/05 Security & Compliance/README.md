# 05 Security & Compliance

## Purpose

This folder protects Prometheus, users, customers, GPS/location data, source code, and startup IP. It is the control center for security reviews, privacy controls, risk controls, and incident response.

## Included Documents

- `docs/security-audit-2026-06-21.md`
- `docs/security-plan.md`
- `scripts/security-check.mjs`
- `_headers`
- `public-site-static/_headers`
- `deploy/cloudflare-pages/_headers`

## When To Use Each Document Or File

- Security Audit: Use before adding beta users, after major app changes, and before customer reviews.
- Security Plan: Use as the high-level protection strategy.
- Security Check Script: Use for local checks when reviewing code and deployment assets.
- Headers Files: Use to confirm browser security headers for deployed assets.

## Who Should Use This Folder

- Founder
- Security reviewer
- CTO / engineering lead
- Cloudflare deployment support
- Legal reviewer
- Customer security contact
- Future Codex sessions doing audits

## Future Documents That Belong Here

- Incident response plan.
- Data retention policy.
- GPS privacy policy.
- Access-control matrix.
- Security questionnaire answers.
- Secrets-management checklist.
- Cloudflare settings checklist.
- GitHub branch-protection checklist.
- Vendor risk register.

## Guardrail

Never print, copy, or send secrets, tokens, private keys, passwords, or sensitive GPS data in documents. If a secret is exposed, identify the file and variable name only, then rotate the secret.

