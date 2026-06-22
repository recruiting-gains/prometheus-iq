# Prometheus IQ Security Audit

Date: 2026-06-21  
Scope: local repository, committed Git history, private and public static deployment packages, client data flow, GPS capture, PWA service worker, package dependencies, live Cloudflare Access front door, and available GitHub repository metadata.

## Architecture Observed

- Private app: static HTML/CSS/JavaScript PWA in `index.html`.
- Storage: browser `localStorage`; backup import/export uses plaintext JSON.
- Route intelligence: deterministic client-side scoring in `scorePlace()` and `routeRecommendation()`.
- GPS: intentional one-time `navigator.geolocation.getCurrentPosition()` capture attached to a visit.
- Authentication: Cloudflare Access protects the deployed hostname. There is no application authentication.
- Roles: Rep and Owner are frontend modes stored in `localStorage`, not authenticated roles.
- Backend/API/database: none found.
- AI/LLM provider: none found. The current route intelligence is not an LLM integration.
- Public website: isolated Vite build from `landing.html`; it does not include the private app or field backups.

## Executive Decision

No Critical credential exposure was found. The hardened local build is suitable for a tightly controlled, single-user or device-isolated prototype after redeployment. It is **not ready for a shared multi-user beta, manager visibility, or cross-business SaaS use** because server authentication, authorization, tenant isolation, database controls, audit logging, and trustworthy GPS verification do not exist.

Launch readiness for the described multi-user product: **4/10**.

## Critical

None confirmed in the current static prototype.

## High Findings

### H1. No server-side authentication, authorization, or tenant isolation - Open

- Evidence: `index.html:1368`, `index.html:1382`, `index.html:2288`.
- Abuse test: a rep switched to Owner Mode and five owner-only surfaces became visible.
- Impact: frontend roles can be spoofed. A future shared database would expose data unless every query is server-scoped.
- Required fix: add authenticated accounts; immutable server-controlled `organization_id`, `user_id`, and role claims; deny-by-default route authorization; and organization/user predicates on every database operation. Owners may read only their organization; reps may read/write only assigned records. Never accept role or organization ownership from request JSON.
- Release test: create two organizations and direct-call every endpoint as the wrong rep, wrong owner, expired user, and revoked user. All must deny.

### H2. Precise GPS remains client-reported and device-local - Partially mitigated

- Evidence: `index.html:2036`, `index.html:2059`, `index.html:2061`.
- Applied patch: coordinates no longer live in editable hidden inputs; they remain in an in-memory `WeakMap` until form submission; the UI now says device-reported rather than verified.
- Remaining impact: browser/OS location can still be spoofed. Exact coordinates are stored unencrypted in browser storage and full backups.
- Required backend fix: authenticated check-in endpoint, server timestamp, strict coordinate/range schema, per-user rate limit, reasonable accuracy threshold, distance-to-business calculation, anomaly detection, and immutable audit record. Treat GPS as evidence, never proof by itself.
- Retention: retain raw GPS for no more than 90 days unless a documented business/legal need requires longer; preserve aggregated visit outcomes after removing raw coordinates.

### H3. Proprietary scoring logic is delivered to every browser - Open

- Evidence: `index.html:1666`, `index.html:1707`.
- Impact: any authorized user can inspect and reproduce the scoring formula. Frontend source cannot be protected as a trade secret.
- Required fix: move proprietary scoring, model prompts, feature weights, and organization-wide aggregation to an authenticated server endpoint. Return only the recommendation and public explanation needed by the rep.

### H4. Hardened changes are not live yet - Open until deployment

- Evidence: the live hostname returns a Cloudflare Access redirect; the reviewed patches exist only in the local deployment folder.
- Impact: the current live app still uses the prior service worker and prior deployment headers until the hardened package is uploaded.
- Required fix: complete the Cloudflare final review, deploy only `deploy/cloudflare-pages`, verify authenticated response headers, then test update behavior on the installed phone PWA.

## Medium Findings

### M1. Sensitive data uses localStorage and plaintext backups - Open

- Evidence: `index.html:1382-1401`, `index.html:1414`.
- Applied patch: every export now warns that GPS/business activity is sensitive; imports warn before replacement; every save is normalized and storage failures are surfaced.
- Remaining impact: an unlocked/shared device, malicious same-origin script, browser profile theft, or shared backup exposes data.
- Required fix: device passcodes and remote wipe for pilots; do not email backups; move shared data to encrypted server storage; use short-lived HttpOnly/Secure/SameSite sessions; document deletion and restore procedures.

### M2. Offline cache bypassed Access revocation - Fixed locally

- Evidence before patch: service worker cached and served authenticated `index.html` offline.
- Patch: `sw.js:1-38` now requires a network navigation, uses `cache: no-store`, returns a 503 offline, and caches only public manifest/icon assets.
- Verification: automated security test rejects any future `index.html` cache or offline fallback.

### M3. Deployment headers and CSP were inconsistent - Fixed locally

- Evidence: `_headers:1-11`, `deploy/cloudflare-pages/_headers:1-11`, `index.html:9`.
- Patch: cryptographic hash for the legitimate inline script; arbitrary inline scripts blocked; no-store; HSTS; frame denial; no-sniff; no-referrer; restrictive Permissions Policy; COOP/CORP; noindex for the private app.
- Residual: inline CSS still requires `style-src 'unsafe-inline'`. Move CSS to a static file later to tighten this further.

### M4. No application audit logging or security alerting - Open

- Impact: no durable record exists for login, exports, GPS submissions, role changes, admin actions, or suspicious writes.
- Required fix: server-side structured audit events with actor, organization, action, target, result, server time, and request ID. Never log coordinates, tokens, notes, or request bodies. Alert on repeated auth failures, role changes, bulk exports, impossible GPS movement, and write spikes.

### M5. Internal business evidence is committed with source - Open governance decision

- Evidence: `evidence/fitness-connection-lsm-2026-05-01-to-2026-06-17.jpg` contains identifiable staff/business performance information.
- Impact: anyone granted repository access receives internal evidence unrelated to building the app.
- Required fix: move evidence and signed legal documents to a separate encrypted evidence vault with narrow access. Remove from Git history only after confirming legal/evidentiary preservation requirements.

### M6. GitHub protection settings are incomplete or unverified - Open

- Verified: repository `PrometheusRouteIQ/prometheus-iq` is private.
- Not verifiable through the available connector: branch protection, push protection, secret scanning, Dependabot, Actions permissions, and deployment environments.
- Required settings: protect `main`; require pull requests and `npm test`; enable secret scanning and push protection; enable Dependabot alerts/security updates; restrict Actions to approved actions with read-only default token permissions; disallow unneeded forks; protect production deployment with an environment approval.

### M7. Cloudflare Access policy details are unverified - Open for final review

- Verified: unauthenticated requests are redirected to Cloudflare Access.
- Required review: deny-by-default policy; explicit approved identities; production and preview/version host coverage; MFA; 8-hour-or-shorter pilot session; rapid session revocation; Access audit logs; least-privilege deployment token; no Global API Key.

## Low Findings

- There is no CI workflow, so `npm test` is not enforced remotely.
- The private app and public website share one repository, increasing accidental deployment risk. The Vite build is isolated and the security test verifies the public entrypoint.
- The client contains exact prospect addresses and operational recommendations. Access must remain limited even before cloud data is added.

## Secrets Review

- No high-confidence API key, GitHub token, OpenAI key, AWS key, private key, or JWT pattern was found in current text files or committed Git history.
- No secret rotation is required based on repository evidence.
- `.gitignore` now excludes `.env*`, `.dev.vars*`, `.wrangler`, private-key formats, backups, deployment ZIPs, and temporary Office files.
- Dashboard-managed Cloudflare credentials were outside repository visibility; verify their scope during deployment review.

## Dependency and Supply Chain Review

- `npm audit`: 0 Critical, High, Moderate, Low, or Info vulnerabilities.
- Lockfile: version 3; 65 packages; all 65 resolved packages have integrity metadata.
- Install-script packages: `esbuild` and optional `fsevents`; expected for the current Vite toolchain.
- No GitHub Actions workflows or third-party CI scripts were found.

## API, Database, and CORS Review

No application API, Worker handler, database, SQL query, CORS policy, JWT, cookie, login, signup, or password-reset implementation exists. Therefore injection, IDOR, mass assignment, SSRF, SQL injection, cookie flags, and API rate limits cannot be validated yet. They are mandatory release-gate tests when the backend is introduced.

## AI/LLM Review

No LLM, OpenAI API, external prompt, model output, tool execution, or autonomous data mutation exists in this repository. Prompt injection is not currently reachable. Future AI recommendations must isolate system instructions from notes/external event text, minimize GPS/business data sent to providers, validate structured model output, prohibit direct writes, and require deterministic server authorization before saving any recommendation.

## Abuse-Case Results

- Rep becomes owner via frontend: **succeeded**; backend role enforcement required.
- Rep reads another rep's cloud data: not testable; no cloud database exists.
- Malicious HTML/script in a place name: **blocked**; rendered as text and did not execute.
- GPS hidden-field tampering: removed; device/OS spoofing still possible.
- GPS spam/rate abuse: not testable; no endpoint exists.
- Token theft: application has no token; stolen Cloudflare Access session remains a risk until expiration/revocation.
- Hidden/old API endpoint discovery: none found.
- Scraping routes/formula: possible for any authorized browser; move proprietary logic server-side.
- Preview/staging bypass: requires Cloudflare dashboard verification.

## Applied Security Patches

- `index.html`: CSP hash, Web Crypto IDs, normalized save path, safe storage errors, sensitive export/import warnings, in-memory GPS capture, accurate location wording.
- `sw.js`: removed authenticated HTML caching and offline app fallback.
- `_headers` and `deploy/cloudflare-pages/_headers`: aligned hardened response policies.
- `.gitignore`: expanded secret/private-material exclusions.
- `scripts/security-check.mjs`: repeatable CSP, secret, deploy-sync, GPS-field, header, identifier, syntax, and cache checks.
- `package.json`: `npm run security:check` and `npm test` release gates.
- `public-site-static/_headers`: framing, cross-origin, HSTS, and permission hardening.

## Must Fix Before Adding More Beta Users

1. Deploy and verify the local hardened static build.
2. Confirm Cloudflare Access explicit identities, MFA, short sessions, revocation, and preview/version URL coverage.
3. Keep each tester device-local; do not advertise secure Owner/Rep roles or manager visibility yet.
4. Establish GPS consent, 90-day raw-location retention, deletion, export handling, and lost-device procedures.
5. Move internal evidence out of the source repository or formally accept the private-repo risk.
6. Enable GitHub secret scanning, push protection, Dependabot, branch protection, and required `npm test`.
7. Before shared cloud data: implement server authentication, organization scoping, authorization, audit logs, rate limits, backups, restore tests, and two-tenant isolation tests.

## Verification Completed

- `npm test`: passed.
- `npm run security:check`: passed.
- `npm run build`: passed.
- `npm audit`: zero vulnerabilities.
- Browser load: passed with no console warnings/errors.
- Malicious-content XSS test: passed.
- Deployment source and reviewed source: synchronized.
- Git object connectivity: passed; dangling development trees are present but no corrupt reachable objects were reported.

## Incident Response Minimum

If a credential or session leaks: revoke Access sessions, disable the affected identity, rotate the specific credential, inspect Access/deployment logs, redeploy a clean build, increment the service-worker cache version, notify affected pilots when required, and document scope/timeline. Never rotate unrelated credentials blindly, and never paste replacement secrets into source or chat.

## Cloudflare References

- Workers static asset headers: https://developers.cloudflare.com/workers/static-assets/headers/
- Cloudflare Access session management: https://developers.cloudflare.com/cloudflare-one/access-controls/access-settings/session-management/
- Cloudflare Access MFA: https://developers.cloudflare.com/cloudflare-one/access-controls/access-settings/independent-mfa/
- Access policy design: https://developers.cloudflare.com/reference-architecture/design-guides/designing-ztna-access-policies/
