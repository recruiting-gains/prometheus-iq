# Subsystem Routing Workflow

## Purpose

Route beta findings to the correct owner without assigning unrelated work or creating new features during stabilization.

## Routing Rules

Dashboard owns:

- Rep/Owner mode behavior.
- Field logging UI.
- Runtime app startup and Places rendering.
- Nearby Opportunities app behavior.
- Visible Dashboard route rendering defects.

Data owns:

- Bad candidate records.
- Invalid Google-qualified businesses.
- Residential houses appearing as route recommendations.
- Pool membership, quarantine, and prospect quality artifacts.

Intelligence Engine owns:

- Scoring, recommendation reasoning, route ordering logic, learning model behavior, and explanation quality.

Infrastructure owns:

- Cloudflare Access.
- Deployment.
- Authenticated production verification.
- Service worker deployment delivery when it is a release/hosting issue.

CRM owns:

- Contact, follow-up, lead, and future communication workflow implementation.

Companion owns:

- Founder-only assistant behavior. Companion does not own tester-facing beta defects.

Mobile owns:

- Device-specific PWA, iPhone, Android, offline, notification, and installed-app behavior that is not purely Dashboard UI code.

Website owns:

- Public website, brand identity, landing page, and conversion surfaces.

Social Media owns:

- Brand channel operations and future social analytics.

Research owns:

- Strategic research and non-production intelligence briefs.

Sales owns:

- Customer-facing pilot process, discovery, demos, ROI, and sales enablement.

Administration owns:

- Intake, status, tester records, device records, issue routing, release verification records, regression verification records, and tester sign-off.

## Handoff Standard

Every routed issue must include:

- Issue ID.
- Tester ID.
- Device ID.
- Version.
- Description.
- Expected behavior.
- Actual behavior.
- Severity.
- Subsystem owner.
- Reproduction or evidence.
- Beta readiness impact.

Do not include secrets, credentials, one-time PINs, private customer data, or employer-confidential data.
