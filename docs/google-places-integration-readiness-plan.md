# Google Places Integration Readiness Plan

## Purpose

This plan prepares Prometheus IQ for a future Google Places integration without adding scope before the live beta. The goal is to enrich qualified prospect data later while keeping the current beta stable, secure, and focused.

## Overview

Google Places can eventually improve Prometheus IQ by adding verified business names, addresses, categories, hours, photos, ratings, and place metadata. This would help qualify prospects, reduce bad recommendations, and support better route intelligence.

This integration should happen after the current beta phase, once the core pilot workflow proves useful.

## Required Google Cloud Setup

- Create or select a Google Cloud project for Prometheus.
- Enable the Google Places API.
- Connect billing to the Google Cloud project.
- Create a restricted API key for Places access.
- Review Google API usage policies before using or storing Places data.
- Document who has access to the Google Cloud project.

OAuth 2.0 may be needed later if Prometheus adds user-specific Google integrations. For Places data enrichment, a restricted server-side API key is the likely first step.

## Required API Key And Security Setup

- Store the Google Places API key server-side only.
- Do not place the API key inside `index.html`, client JavaScript, screenshots, public docs, or GitHub.
- Use Cloudflare secrets, environment variables, or another approved secrets manager.
- Restrict the API key to the required Google APIs only.
- Restrict usage by allowed server origin or deployment where supported.
- Add rate limiting on Prometheus-side endpoints that call Google Places.
- Log API usage counts, but do not log full keys or sensitive user data.

## Estimated Cost Ranges

These are planning estimates only and must be verified against current Google pricing before launch.

- Beta with roughly 10 reps: approximately $5-$10 per month if usage is low and cached.
- 100 reps: approximately $50-$100 per month if usage is controlled and not queried repeatedly.

Cost depends heavily on request volume, caching, place detail calls, and refresh frequency.

## Recommended Architecture

### Server-Side

All Google Places calls should happen from a server-side layer such as a Cloudflare Worker. The API key should never be exposed to the browser.

### Frontend

The app should display only approved, cleaned, and limited prospect data returned by the server. The frontend should not call Google Places directly.

### Data Flow

1. Prometheus requests qualified prospects for a route area.
2. Server-side logic queries Google Places.
3. Results are filtered for walk-in suitability and business usefulness.
4. Approved results are stored or cached in the qualified prospect database.
5. Route Intelligence uses approved prospect records, not raw Google results.

## Risks, Limits, And Security Considerations

- Rate limits can interrupt enrichment if usage is not controlled.
- Cost can rise quickly if the app repeatedly asks for the same details.
- Google data can be inaccurate, outdated, incomplete, or broad.
- Places data should not automatically become a route recommendation without qualification.
- API keys must be rotated immediately if exposed.
- Logs must not expose API keys, precise user data, or sensitive business information.
- Prometheus must comply with Google API terms, including storage and display rules.

## Beta Decision

Do not add Google Places integration during Anthony's first live beta unless the beta is blocked without it.

The current beta should test:

- Whether the rep uses Prometheus daily.
- Whether GPS verification works.
- Whether visit logging is simple enough.
- Whether Route Intelligence v4.1 produces usable stops.
- Whether Anthony can complete the workflow without founder hand-holding.

## Future Implementation Trigger

Start Google Places integration only after at least one of these happens:

- The pilot proves reps need a larger verified prospect inventory.
- Manual prospect maintenance becomes too slow.
- A paying or approved pilot requires larger territory coverage.
- Prometheus needs repeatable prospect generation for more than one rep or market.

## Recommendation

Google Places is a strong next-stage capability, but it is not the highest priority before tomorrow's beta. Keep the beta stable, collect real usage data, and revisit Google Places after the pilot workflow has been proven.
