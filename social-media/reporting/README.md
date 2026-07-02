# Social Media Reporting

Owner: Prometheus Social Media

## Founder Instagram Analytics Reporting View v1

`founder-instagram-analytics-reporting-view.js` transforms normalized Instagram, Website attribution, and CRM attribution inputs into a read-only executive reporting view.

It does not:

- call Instagram APIs
- access Meta credentials
- duplicate ingestion logic
- modify Infrastructure
- modify Companion
- modify Website attribution
- modify CRM attribution
- enable posting, DMs, comments automation, or scraping

Required input sources:

- Source: Prometheus Social Media
- Source: Prometheus Website
- Source: Prometheus CRM

The view is presentation-only and should be consumed by downstream surfaces through the returned report object.
