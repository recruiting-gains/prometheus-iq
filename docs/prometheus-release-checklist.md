# Prometheus Release Checklist

This checklist is the permanent release procedure for Prometheus IQ beta and production-readiness work. Use it before sending any live link to a founder, representative, manager, or beta tester.

## 1. Local Verification

- Confirm the repository is on the expected branch.
- Confirm the local dashboard source is the approved current source.
- Confirm no duplicate dashboard or prototype is being used for release.
- Confirm syntax checks pass.
- Confirm no unrelated local work is mixed into the release.
- Confirm `.env` remains local and ignored.
- Confirm reset-version migrations run after localStorage rehydration and cannot be overwritten by stale top-level profile data.

## 2. GitHub Verification

- Confirm the latest intended work is committed before release.
- Confirm `main` and `origin/main` match when a release depends on GitHub state.
- Confirm no API keys, tokens, credentials, screenshots, generated previews, generated audio, desktop wallpapers, or private Founder Companion artifacts are staged.
- Confirm the commit contents match the milestone being released.

## 3. Cloudflare Verification

- Run the automated production release gate before any production handoff:

```bash
npm run verify:production-release -- --expected-worker-version <CURRENT_WORKER_VERSION> --cdp http://127.0.0.1:<AUTHENTICATED_CHROME_DEBUG_PORT>
```

- Use the local-only gate before commit or when Cloudflare authentication is not available yet:

```bash
npm run verify:production-release:local
```

- The full gate reuses the existing local security, runtime-pool, and zero-live-Google checks, then verifies Wrangler deployment metadata, Cloudflare Access protection, authenticated production headers/assets, build marker, service worker version, active runtime pool, PWA manifest, browser startup health, and production console/network health.
- For authenticated production checks, provide either `--cdp http://127.0.0.1:<port>` for an already-authenticated Chrome session or a private `PROMETHEUS_ACCESS_COOKIE`/`CF_AUTHORIZATION` + `CF_APPSESSION` environment value. Do not commit or print those values.
- Confirm the Cloudflare deployment package matches the approved local source.
- Confirm the live URL serves the same approved dashboard.
- If the live authenticated URL is still missing current behavior after `deploy/cloudflare-pages` is synced, treat production as stale until the existing Cloudflare Worker is redeployed and rechecked. A synced package alone is not live production verification.
- Confirm installed Home Screen/PWA sessions have received the current service worker and app build version before Founder or beta acceptance.
- If a Home Screen app is missing current route, Copy Summary, or Export Report behavior, close and reopen it after deployment so the new service worker can claim the session.
- Confirm Cloudflare Access still protects private beta URLs.
- Confirm approved beta emails are present in the existing Access policy.
- Confirm Email One-Time PIN testers request and use the newest code in the same browser session.

## 4. Google Verification

- Confirm Google Places and Geocoding are configured only through secure local or backend environment variables.
- Confirm no Google API key appears in frontend code, Git, logs, screenshots, or documentation.
- Confirm route recommendations include Google source, Google Place ID, verified business name, verified numbered address, and Google Maps-safe directions.
- Confirm Google verification metadata survives localStorage save, refresh, profile switching, export, and import.
- Confirm quarantined, generic, duplicate, or unverified destinations do not appear in route recommendations.

## 5. Founder Acceptance

- Confirm Founder profile opens with owner/admin permissions intact.
- Confirm Founder learning reset, if scheduled, clears only learning data and preserves account, access, owner tools, Google integration, Cloudflare access, and company configuration.
- Confirm route generation works.
- Confirm Open Route and Directions work.
- Confirm Log Result works.
- Confirm Copy Today's Summary works.
- Confirm Export Today's Report works.
- Confirm owner functions remain available to Founder.

## 6. Beta Acceptance

- Confirm beta users open in Rep mode only.
- Confirm owner/admin controls are not visible in Rep mode.
- Confirm the exact beta URL opens the current approved dashboard.
- Confirm any scheduled representative learning reset clears only that representative's learning data and preserves access, permissions, and route availability.
- Confirm Google-qualified Route Intelligence is visible on the live beta URL when Google route intelligence is part of the test.
- Confirm directions links open usable Google Maps destinations.
- Confirm the beta user can log results.
- Confirm the beta user can copy or export the daily report if centralized sync is not yet enabled.

## 7. Companion Verification

- Confirm the installed Prometheus Companion runtime matches the repository version when Companion changes are part of the release.
- Confirm the local backend is healthy.
- Confirm the Prometheus OS server is healthy.
- Confirm microphone, speech recognition, Intelligence Orchestrator routing, premium TTS, and fallback behavior are verified before Founder Acceptance.
- Confirm natural founder questions route through intelligence/reasoning, while explicit card commands still open existing cards.

## 8. Export Verification

- Confirm Copy Today's Summary includes rep name, date, visits, conversations, leads, units, notes or outcomes, visited place names, and timestamps.
- Confirm Export Today's Report produces a JSON report from existing localStorage data.
- Confirm export does not include secrets, API keys, credentials, or unrelated private Founder Companion data.

## 9. Route Verification

- Confirm visible route stops are real businesses.
- Confirm every recommended stop has a specific business name.
- Confirm every recommended stop has a usable street address.
- Confirm every recommended stop opens Google Maps correctly.
- Confirm no route has duplicate businesses.
- Confirm no generic labels, placeholders, internal marketing descriptions, malls, campuses, airports, broad hospitals, schools, government buildings, park-and-rides, or unverified locations appear.
- After logging a verified stop, confirm Nearby Opportunities shows only Google-qualified businesses within walking range and excludes the current or already-visited business.

## 10. Production Synchronization Notes

- Root cause pattern to watch: if localStorage normalization drops Google metadata such as `googlePlaceId`, `googleMapsUrl`, `sourceType`, or coordinates, production routes can degrade into stale or non-qualified local places after save/refresh.
- Permanent procedure: every release that changes the dashboard must sync `index.html`, `sw.js`, manifest, headers, and deployment package before Cloudflare verification.
- Permanent deployment procedure: after package sync, redeploy the existing protected Cloudflare Worker or Pages asset deployment, then inspect the authenticated live URL for the current app build and release behavior. Do not claim production synchronization from local/package verification alone.
- Permanent PWA procedure: after deployment, verify both browser and Home Screen installs so service-worker caching cannot hide the latest production dashboard.

## 11. Nearby Opportunities Verification

- Log a clearly labeled test visit on a Google-qualified route stop.
- Confirm Nearby Opportunities appears below Today's Route.
- Confirm every nearby recommendation has a Google Place ID, verified business name, verified numbered address, representative-facing category, walking distance, and Directions link.
- Confirm the current stop, already visited stops, duplicates, quarantined businesses, placeholders, and generic categories do not appear.

## 12. Performance Baseline

Record the baseline for each release:

- Startup time.
- Route generation time.
- Google lookup or Google-qualified route validation time.
- Log Result time.
- Copy Summary time.
- Export time.

Do not optimize during baseline measurement unless a critical release blocker is discovered.
