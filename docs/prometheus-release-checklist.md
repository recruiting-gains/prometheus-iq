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

- Confirm the Cloudflare deployment package matches the approved local source.
- Confirm the live URL serves the same approved dashboard.
- Confirm Cloudflare Access still protects private beta URLs.
- Confirm approved beta emails are present in the existing Access policy.
- Confirm Email One-Time PIN testers request and use the newest code in the same browser session.

## 4. Google Verification

- Confirm Google Places and Geocoding are configured only through secure local or backend environment variables.
- Confirm no Google API key appears in frontend code, Git, logs, screenshots, or documentation.
- Confirm route recommendations include Google source, Google Place ID, verified business name, verified numbered address, and Google Maps-safe directions.
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

## 10. Performance Baseline

Record the baseline for each release:

- Startup time.
- Route generation time.
- Google lookup or Google-qualified route validation time.
- Log Result time.
- Copy Summary time.
- Export time.

Do not optimize during baseline measurement unless a critical release blocker is discovered.
