# Prometheus IQ Engineering Master Inventory

Status: Complete
Created: 2026-06-28
Repository: `/Users/cruzgarza/Documents/Prometheus`
Branch reviewed: `main`
Latest reviewed commit: `7e1d948 feat: add nearby opportunities and production sync safeguards`

## Executive Summary

Prometheus IQ has moved from a local field-sales dashboard into a production beta ecosystem with Google-qualified Route Intelligence, protected Cloudflare access, Founder and representative profiles, learning resets, rep-safe daily handoff, export/copy reporting, release procedures, and a private Founder Companion/Prometheus OS.

The current approved Prometheus IQ dashboard is the existing single-page application in:

- `index.html`
- `deploy/cloudflare-pages/index.html`

These files currently match. The deployment support files also match:

- `sw.js`
- `deploy/cloudflare-pages/sw.js`
- `_headers`
- `deploy/cloudflare-pages/_headers`

The main engineering risk going forward is duplicate effort. Multiple architecture documents now exist for Route Intelligence V2, Continuous Learning, Companion reasoning, Google discovery, beta onboarding, and release verification. Future prompts should read this master inventory, the Constitution, and the release checklist before requesting new work.

The second major risk is data centralization. Prometheus IQ currently supports beta-safe local logging plus Copy Today Summary and Export Today Report. That protects Anthony's beta results from being trapped on his phone only if the representative actually copies or exports the report. A full owner-visible backend data flow is intentionally not built yet.

## Existing Work Verification

1. Is today's requested work already built?

Partially. Several inventories and reports exist, including `prometheus-worktree-audit-report.md`, `dashboard-intelligence-report.md`, `prometheus-route-intelligence-quality-report.md`, `docs/route-intelligence-v2-architecture.md`, `docs/continuous-learning-framework.md`, and `docs/prometheus-release-checklist.md`. No single master engineering inventory existed before this document.

2. Is it partially built?

Yes. The required facts were spread across commit history, documentation, reports, data manifests, the dashboard source, deployment package, Companion source, and beta notes.

3. Where does it already exist?

- Current product source: `index.html`
- Cloudflare deployment package source: `deploy/cloudflare-pages/index.html`
- Release procedure: `docs/prometheus-release-checklist.md`
- Route Intelligence architecture: `docs/route-intelligence-v2-architecture.md`
- Continuous learning architecture: `docs/continuous-learning-framework.md`
- Dashboard intelligence report: `dashboard-intelligence-report.md`
- Google route quality report: `prometheus-route-intelligence-quality-report.md`
- Qualified prospect process: `data/qualified-prospects/README.md`
- Companion architecture and modules: `prometheus-os/`
- Native Companion: `mac-companion/`
- Worktree audit: `prometheus-worktree-audit-report.md`

4. Should it be reused?

Yes. This inventory reuses and consolidates existing verified sources. It does not replace Route Intelligence, Companion, the dashboard, beta documentation, or the release checklist.

5. Should it be improved?

Yes. The main improvement needed was consolidation into one engineering source of truth.

6. What should not be duplicated?

Do not duplicate:

- The Prometheus IQ dashboard.
- Route Intelligence.
- Google discovery.
- representative profile storage.
- learning reset logic.
- Copy Today Summary.
- Export Today Report.
- Owner Mode.
- Rep Mode.
- Companion reasoning/orchestrator systems.
- Cloudflare Access setup.
- Route Intelligence V2 architecture.
- Continuous Learning Framework.
- release checklist.

## Source Review Performed

Reviewed sources:

- `PROMETHEUS_CONSTITUTION.md`
- Git commit history from repository initialization through `7e1d948`
- `git status --short`
- `git diff --stat`
- `index.html`
- `deploy/cloudflare-pages/index.html`
- `sw.js`
- `deploy/cloudflare-pages/sw.js`
- `_headers`
- `deploy/cloudflare-pages/_headers`
- `docs/`
- `prometheus-os/`
- `mac-companion/`
- `data/qualified-prospects/`
- `scripts/`
- major root-level reports

Not reviewed by design:

- `.env` files
- API keys
- tokens
- private credentials
- generated screenshots
- personal desktop artifacts

## Repository State At Time Of Inventory

Current branch: `main`

Current production source parity:

- `index.html` matches `deploy/cloudflare-pages/index.html`
- `sw.js` matches `deploy/cloudflare-pages/sw.js`
- `_headers` matches `deploy/cloudflare-pages/_headers`

Known local dirty worktree items at time of inventory:

- Modified Companion and Prometheus OS files.
- Untracked Companion reasoning/report files.
- Untracked social-media prep files.
- Untracked demos/prototypes.
- Untracked screenshots/previews.
- Untracked desktop wallpaper assets.
- Untracked Google discovery config/route preview files.
- Untracked Chris pilot package folder.

These local changes were not committed or pushed by this inventory mission.

## Engineering Inventory

### 1. Prometheus IQ Core Dashboard

Feature Name: Existing single-page Prometheus IQ dashboard

Purpose:
Provide the field-sales operating surface for route recommendations, daily score, visit logging, owner visibility, and beta testing.

Current Status:
Production beta implemented.

Files involved:

- `index.html`
- `deploy/cloudflare-pages/index.html`
- `manifest.webmanifest`
- `sw.js`
- `_headers`
- `deploy/cloudflare-pages/manifest.webmanifest`
- `deploy/cloudflare-pages/sw.js`
- `deploy/cloudflare-pages/_headers`

Dependencies:

- Browser localStorage under `prometheus-v1`
- Cloudflare deployment
- Google-qualified embedded route data
- Cloudflare Access for private beta

Verification completed:

- Local dashboard source and deployment package source currently match.
- App build version in source is `2026-06-28-nearby-opportunities-v1`.
- Release checklist defines local, GitHub, Cloudflare, Founder, beta, export, and route verification.

Current limitations:

- Large monolithic HTML file increases risk during future edits.
- Data is mostly localStorage-based.
- Live production still requires authenticated Cloudflare inspection for final acceptance.

Future roadmap:

- Preserve dashboard while moving data sync to a secure backend later.
- Keep intelligence improvements behind the existing dashboard.

Risk level:
Medium. Product is usable for beta, but state, UI, and logic are concentrated in one large file.

### 2. Rep Mode

Feature Name: Rep Mode

Purpose:
Let a representative use Prometheus IQ without owner/admin controls.

Current Status:
Implemented.

Files involved:

- `index.html`
- `deploy/cloudflare-pages/index.html`
- `docs/beta-sharing-plan.md`

Dependencies:

- URL role parameters
- session role logic
- CSS visibility rules for owner/admin controls
- Cloudflare Access

Verification completed:

- Beta checklist documents that Rep mode must hide owner/admin controls.
- Live Anthony beta notes recorded successful Rep mode loading during the June 26 stabilization.

Current limitations:

- Rep mode is not a separate app; it depends on role/session handling in the same dashboard.
- Owner visibility is hidden through existing app logic and CSS, so regressions must be checked every release.

Future roadmap:

- Maintain one dashboard and improve role checks.

Risk level:
Medium.

### 3. Owner / Founder Mode

Feature Name: Owner Mode / Founder profile

Purpose:
Let Cruz view owner functions, team reporting, and founder profile data.

Current Status:
Implemented and reset-capable.

Files involved:

- `index.html`
- `deploy/cloudflare-pages/index.html`
- `docs/prometheus-release-checklist.md`

Dependencies:

- Founder profile `cruz`
- `founderLearningResetVersion = "2026-06-27-founder-day-1-reset-v1"`
- session role permissions
- Cloudflare Access

Verification completed:

- Founder reset commit `bb98e14` added founder reset and route-readiness verification.
- Release checklist includes Founder Acceptance flow.

Current limitations:

- Founder Home Screen/PWA can be affected by service-worker cache if not refreshed after release.

Future roadmap:

- Owner-visible centralized reporting after backend data sync is approved.

Risk level:
Medium.

### 4. Today Scoreboard Intelligence

Feature Name: Today Scoreboard context

Purpose:
Make dashboard metrics more useful by explaining pace, need, route depth, and conversion context.

Current Status:
Implemented.

Files involved:

- `index.html`
- `dashboard-intelligence-report.md`

Dependencies:

- visits
- leads
- units
- category performance
- same-weekday pace
- route scores

Verification completed:

- Commit `47226a2 feat: add Prometheus IQ dashboard intelligence engine`
- `dashboard-intelligence-report.md` records inline JavaScript parse and CSP verification.

Current limitations:

- Early data means estimates are not yet proven.

Future roadmap:

- Feed with real beta outcomes.

Risk level:
Low to Medium.

### 5. Log Result

Feature Name: Log Result

Purpose:
Capture field activity: visit, conversation, lead, units, notes/outcome, timestamp, and optional GPS-attached location.

Current Status:
Implemented.

Files involved:

- `index.html`
- `deploy/cloudflare-pages/index.html`
- `docs/prometheus-release-checklist.md`

Dependencies:

- browser localStorage
- active representative profile
- place identity
- optional browser geolocation

Verification completed:

- Initial verified visit location capture commit `4ce23a8`
- Release checklist requires Log Result verification.
- Later beta handoff verification includes test logging.

Current limitations:

- Logged data remains on the user's device unless copied/exported.
- No centralized owner view of remote rep data yet.

Future roadmap:

- Secure backend storage for owner-visible beta data.

Risk level:
Medium.

### 6. Copy Today Summary

Feature Name: Copy Today's Summary

Purpose:
Let a representative send Cruz a plain-text daily result summary without a backend.

Current Status:
Implemented.

Files involved:

- `index.html`
- `deploy/cloudflare-pages/index.html`
- `docs/prometheus-release-checklist.md`

Dependencies:

- localStorage visit data
- Clipboard API with fallback messaging
- active representative profile

Verification completed:

- Commit `6b984a1 feat: add beta-safe rep daily handoff`
- Release checklist includes export/copy verification requirements.

Current limitations:

- Requires user action.
- Clipboard permissions can vary by browser/device.

Future roadmap:

- Replace manual handoff with secure backend sync when approved.

Risk level:
Low for beta handoff, Medium as a long-term data strategy.

### 7. Export Today Report

Feature Name: Export Today's Report

Purpose:
Let a representative export a JSON report from localStorage.

Current Status:
Implemented.

Files involved:

- `index.html`
- `deploy/cloudflare-pages/index.html`
- `docs/prometheus-release-checklist.md`

Dependencies:

- browser Blob/download support
- localStorage data

Verification completed:

- Commit `6b984a1`
- Release checklist defines the included fields and security exclusions.

Current limitations:

- Requires user action and sending file to Cruz.
- JSON report is not automatically imported into owner mode.

Future roadmap:

- Cloud sync or secure upload pipeline.

Risk level:
Low for beta, Medium for scale.

### 8. Route Intelligence Core

Feature Name: Route Intelligence

Purpose:
Recommend where a representative should go next using route scoring, category diversity, freshness, confidence, and representative profile data.

Current Status:
Implemented and production-beta hardened.

Files involved:

- `index.html`
- `deploy/cloudflare-pages/index.html`
- `dashboard-intelligence-report.md`
- `prometheus-route-intelligence-quality-report.md`
- `docs/route-intelligence-v2-architecture.md`
- `docs/continuous-learning-framework.md`

Dependencies:

- place records
- route history
- recommendation history
- visit outcomes
- category data
- Google validation metadata
- profile resets

Verification completed:

- Dashboard intelligence commit `47226a2`
- Google quality hardening commits `e6a42b1`, `0582d41`, `7982a44`, `bb98e14`, `7e1d948`
- Release checklist defines production route requirements.

Current limitations:

- Learning is still early and mostly local.
- Explanations improve with field data.

Future roadmap:

- Implement Route Intelligence V2 learning phases after field evidence exists.

Risk level:
Medium.

### 9. Google Places / Route Qualification

Feature Name: Google-qualified business discovery and route pool

Purpose:
Use real Google-qualified businesses instead of static or placeholder prospects.

Current Status:
Implemented for local discovery and production beta route data.

Files involved:

- `data/qualified-prospects/README.md`
- `data/qualified-prospects/qualified-prospects.schema.json`
- `data/qualified-prospects/anthony-almeda-qualified-prospects.seed.json`
- `scripts/discover-google-qualified-prospects.mjs`
- `scripts/lib/qualified-prospect-routing.mjs`
- `index.html`
- `deploy/cloudflare-pages/index.html`

Dependencies:

- local `.env` with `GOOGLE_MAPS_API_KEY`
- Google Places API
- Google Geocoding API
- local discovery script

Verification completed:

- Google setup and discovery were reported complete during the project.
- Documentation records that Google discovery produced production route candidates.
- Release checklist requires Google source, Google Place ID, verified business name, numbered address, and Google Maps-safe directions.

Current limitations:

- API key is local/backend-only and not in frontend.
- The dashboard currently embeds approved Google-qualified data; it is not dynamically fetching live Google results from the browser.
- Google data can become stale.

Future roadmap:

- Backend refresh workflow.
- Secure scheduled discovery.
- Territory refresh per location.

Risk level:
Medium.

### 10. Google Maps Directions

Feature Name: Google Maps-safe Directions links

Purpose:
Ensure every route stop opens a usable Google Maps destination.

Current Status:
Implemented and hardened.

Files involved:

- `index.html`
- `deploy/cloudflare-pages/index.html`
- `docs/prometheus-release-checklist.md`

Dependencies:

- Google Maps URL
- Google Place ID
- verified address
- direction URL builder

Verification completed:

- Route quality hardening commits targeted invalid places and bad directions.
- Release checklist requires every visible route stop to open Google Maps correctly.

Current limitations:

- Requires ongoing live verification because Google results and map URLs can change.

Future roadmap:

- Automated direction validation in backend build pipeline.

Risk level:
Low to Medium.

### 11. Quarantine / Invalid Place Protection

Feature Name: quarantine and quality gates

Purpose:
Prevent generic, duplicate, invalid, stale, vague, or unverified places from entering visible routes.

Current Status:
Implemented.

Files involved:

- `index.html`
- `deploy/cloudflare-pages/index.html`
- `prometheus-route-intelligence-quality-report.md`
- `docs/prometheus-release-checklist.md`

Dependencies:

- route identity keys
- Google metadata
- source type
- category rules
- hardening rules

Verification completed:

- Commits `e6a42b1` and `0582d41` specifically hardened Anthony route quality.
- Known bad targets were removed or quarantined during Anthony beta fixes.

Current limitations:

- Quality gates must be maintained as new territories are added.

Future roadmap:

- Central quarantine registry with automated tests.

Risk level:
Medium.

### 12. Duplicate Recommendation Protection

Feature Name: route duplicate protection

Purpose:
Prevent the same business from appearing twice in active route recommendations or nearby opportunities.

Current Status:
Implemented.

Files involved:

- `index.html`
- `deploy/cloudflare-pages/index.html`

Dependencies:

- `routeIdentityKey`
- Google Place ID
- normalized business name/address
- route list filtering

Verification completed:

- Anthony field feedback on duplicate Urban Bird led to route quality fixes.
- Release checklist requires no duplicate route stops.

Current limitations:

- Duplicate detection depends on available Google ID/name/address quality.

Future roadmap:

- More robust canonical identity service if backend sync is added.

Risk level:
Low to Medium.

### 13. Nearby Opportunities

Feature Name: Nearby Opportunities

Purpose:
After a representative logs or visits a business, show additional Google-qualified businesses within walking range to reduce driving time.

Current Status:
Implemented.

Files involved:

- `index.html`
- `deploy/cloudflare-pages/index.html`
- `docs/prometheus-release-checklist.md`

Dependencies:

- latest visited/logged place
- coordinates
- Google Place ID
- route identity/dedupe rules
- quarantine rules
- `nearbyOpportunityRadiusFeet = 500`

Verification completed:

- Commit `7e1d948 feat: add nearby opportunities and production sync safeguards`
- Release checklist includes Nearby Opportunities verification.

Current limitations:

- Uses available embedded/qualified route pool; not live Google fetch at the moment of visit.
- Needs field validation for usefulness.

Future roadmap:

- Live backend refresh around current stop when cloud sync/API architecture is approved.

Risk level:
Medium.

### 14. Anthony Profile

Feature Name: Anthony beta profile

Purpose:
Give Anthony a rep-specific beta route and learning profile without inheriting Cruz's learning.

Current Status:
Implemented and reset-hardened.

Files involved:

- `index.html`
- `deploy/cloudflare-pages/index.html`
- `docs/beta-sharing-plan.md`

Dependencies:

- URL parameter `rep=Anthony`
- Cloudflare Access email policy
- localStorage profile storage
- reset version `2026-06-27-anthony-startup-sync-reset-v2`

Verification completed:

- Commit `b0f6295 Import Anthony private route profile`
- Commit `14c5307 fix: stabilize Anthony beta route intelligence access`
- Commit `7982a44 fix: prevent Anthony learning reset startup overwrite`

Current limitations:

- Anthony's actual logged beta results remain on his device unless copied/exported.
- Cloudflare OTP flow can be sensitive to stale login sessions.

Future roadmap:

- Secure centralized rep data capture.

Risk level:
Medium.

### 15. Founder Day 1 Reset

Feature Name: Founder learning reset

Purpose:
Reset Cruz's learning profile while preserving owner account, access, permissions, configuration, Google integration, and tools.

Current Status:
Implemented.

Files involved:

- `index.html`
- `deploy/cloudflare-pages/index.html`
- `docs/prometheus-release-checklist.md`

Dependencies:

- `founderLearningResetVersion`
- profile normalization
- localStorage migration

Verification completed:

- Commit `bb98e14 fix: reset founder learning and verify route readiness`

Current limitations:

- PWA/Home Screen caches can delay the reset appearing until the app refreshes the latest build.

Future roadmap:

- Backend profile state.

Risk level:
Medium.

### 16. Anthony Day 1 Reset

Feature Name: Anthony learning reset

Purpose:
Reset Anthony's learning without deleting Anthony, his access, or his account.

Current Status:
Implemented and startup-order bug fixed.

Files involved:

- `index.html`
- `deploy/cloudflare-pages/index.html`

Dependencies:

- `anthonyLearningResetVersion`
- profile normalization
- startup profile switching
- top-level localStorage migration safeguards

Verification completed:

- Commit `7982a44` fixed the startup synchronization bug where old top-level data could overwrite Anthony's reset profile.

Current limitations:

- Requires the live device to load the updated build and localStorage migration.

Future roadmap:

- Backend profile state with explicit migration records.

Risk level:
Medium.

### 17. Representative Learning

Feature Name: current representative learning

Purpose:
Adjust recommendations using route history, visit data, category performance, time windows, and outcomes.

Current Status:
Implemented at a beta level; V2 architecture complete.

Files involved:

- `index.html`
- `docs/route-intelligence-v2-architecture.md`
- `docs/continuous-learning-framework.md`

Dependencies:

- representative profiles
- visits
- route history
- recommendation history
- category/time-window metrics
- learned preferences and confidence adjustment fields

Verification completed:

- Current learning is documented in Route Intelligence V2.
- Current dashboard uses available evidence but avoids claiming proven learning from thin samples.

Current limitations:

- Does not yet maintain a durable evidence bucket model.
- Does not yet fully explain why a representative succeeds across combinations of category, time, sequence, and place type.

Future roadmap:

- Route Intelligence V2 phases.
- Continuous Learning Framework implementation.

Risk level:
Medium.

### 18. Representative DNA

Feature Name: Representative DNA

Purpose:
Model long-term patterns in representative behavior without hardcoding a person or industry.

Current Status:
Architecture complete; not fully implemented.

Files involved:

- `docs/route-intelligence-v2-architecture.md`
- `docs/continuous-learning-framework.md`

Dependencies:

- field evidence
- category/time/place/sequence/outcome data
- sample-size safeguards

Verification completed:

- Architecture documents define the philosophy, evidence model, and safeguards.

Current limitations:

- Not yet a production scoring module.

Future roadmap:

- Evidence buckets, bounded confidence changes, DNA summaries, and eventual cloud-synced learning.

Risk level:
Low now because it is documentation only; Medium when implemented.

### 19. Continuous Learning Framework

Feature Name: Continuous Learning Framework

Purpose:
Define how Prometheus learns safely from real-world behavior over months and years.

Current Status:
Architecture complete.

Files involved:

- `docs/continuous-learning-framework.md`

Dependencies:

- Route Intelligence V2
- verified field evidence
- future backend storage

Verification completed:

- Commit `0a16046 docs: add Route Intelligence continuous learning framework`

Current limitations:

- Not implemented as active production behavior.

Future roadmap:

- Evidence admission rules.
- confidence maturity.
- exploration/proven-path balancing.
- safeguards against outliers.

Risk level:
Low as a document, Medium when implemented.

### 20. Route Intelligence V2 Architecture

Feature Name: Route Intelligence V2 Architecture

Purpose:
Design the next evolution of Route Intelligence so it learns why representatives succeed, not only what happened.

Current Status:
Architecture complete.

Files involved:

- `docs/route-intelligence-v2-architecture.md`

Dependencies:

- existing dashboard
- existing route engine
- existing localStorage profile model
- Google qualification
- current visit logs

Verification completed:

- Commit `6a5cd3e docs: add Route Intelligence V2 architecture`

Current limitations:

- Design only.

Future roadmap:

- Implement in phases after real field evidence.

Risk level:
Low.

### 21. Cloudflare Deployment Package

Feature Name: Cloudflare deployment package and protected beta URL

Purpose:
Serve Prometheus IQ as a private beta through Cloudflare.

Current Status:
Implemented and repeatedly stabilized.

Files involved:

- `deploy/cloudflare-pages/index.html`
- `deploy/cloudflare-pages/sw.js`
- `deploy/cloudflare-pages/_headers`
- `deploy/cloudflare-pages/manifest.webmanifest`
- `deploy/Prometheus_IQ_Cloudflare_Upload.zip`
- `docs/beta-sharing-plan.md`
- `docs/prometheus-release-checklist.md`

Dependencies:

- Cloudflare Workers/Pages deployment
- Cloudflare Access
- service worker cache

Verification completed:

- Commit `14c5307` stabilized Anthony beta access.
- Beta plan records live deployment ID `ea14d08a` for June 26 stabilization.
- Current local and deploy files match.

Current limitations:

- Live authenticated verification requires Cloudflare access and manual inspection.
- Home Screen/PWA versions can cache older builds.

Future roadmap:

- More automated release verification.

Risk level:
Medium.

### 22. Cloudflare Access / One-Time PIN

Feature Name: Cloudflare Access beta authentication

Purpose:
Protect private beta access while allowing approved testers through email One-Time PIN.

Current Status:
Implemented operationally; documented.

Files involved:

- `docs/beta-sharing-plan.md`
- `docs/prometheus-release-checklist.md`

Dependencies:

- Cloudflare Access app
- approved email policy
- Email One-Time PIN

Verification completed:

- Anthony access policy and Email OTP setup were documented in beta stabilization notes.

Current limitations:

- OTP codes are single-use and session-sensitive.
- Email delivery or stale challenge pages can cause tester friction.

Future roadmap:

- Better tester onboarding instructions and possibly a cleaner auth flow.

Risk level:
Medium.

### 23. Service Worker / PWA Synchronization

Feature Name: service worker production synchronization

Purpose:
Control cache and app version behavior for browser and Home Screen installs.

Current Status:
Implemented with production sync safeguards.

Files involved:

- `sw.js`
- `deploy/cloudflare-pages/sw.js`
- `docs/prometheus-release-checklist.md`

Dependencies:

- app build version
- service worker lifecycle
- PWA/browser cache

Verification completed:

- Commit `7e1d948` added production sync safeguards.
- Release checklist documents PWA/Home Screen verification.

Current limitations:

- User may need to close/reopen Home Screen app after deployment.

Future roadmap:

- More explicit in-app version/status display.

Risk level:
Medium.

### 24. Public PrometheusRouteIQ Website

Feature Name: cinematic public website

Purpose:
Public marketing and CTA experience for Prometheus IQ.

Current Status:
Implemented separately from the private dashboard.

Files involved:

- `deploy/prometheusrouteiq-website/index.html`
- `deploy/prometheusrouteiq-website/app.js`
- `deploy/prometheusrouteiq-website/styles.css`
- `deploy/prometheusrouteiq-website/README.md`
- `docs/prometheus-routeiq-cta-experience-upgrade.md`
- `docs/public-site-cloudflare-readiness.md`

Dependencies:

- external script asset
- Cloudflare deployment for public website
- Three.js/visual fallback behavior

Verification completed:

- Commits from `7597756` through `ffdcad9` built and stabilized the cinematic public website and CTA experiences.

Current limitations:

- Separate from Prometheus IQ beta.
- Must not be confused with production dashboard deployment.

Future roadmap:

- Continue design refinement separately from dashboard/Companion work.

Risk level:
Low if kept separate.

### 25. Request Pilot Experience

Feature Name: Request Pilot CTA experience

Purpose:
Collect pilot information and produce a readiness-style experience on the public website.

Current Status:
Implemented in public website.

Files involved:

- `deploy/prometheusrouteiq-website/app.js`
- `docs/prometheus-routeiq-cta-experience-upgrade.md`

Dependencies:

- public website JS and CSS

Verification completed:

- Commit `e16179f Add interactive website CTA experiences`

Current limitations:

- Not a backend lead capture system yet.

Future roadmap:

- Secure lead capture backend or CRM integration.

Risk level:
Low.

### 26. View Demo Experience

Feature Name: cinematic interactive demo CTA

Purpose:
Demonstrate Route Intelligence without a boring video.

Current Status:
Implemented in public website.

Files involved:

- `deploy/prometheusrouteiq-website/app.js`
- `docs/prometheus-routeiq-cta-experience-upgrade.md`

Dependencies:

- public website runtime

Verification completed:

- Commit `e16179f`

Current limitations:

- Demo is marketing, not the actual protected dashboard.

Future roadmap:

- Keep visually aligned with product without exposing private beta.

Risk level:
Low.

### 27. Prometheus OS / Companion

Feature Name: Prometheus Companion / Prometheus OS

Purpose:
Private founder-only operating system and assistant for Cruz.

Current Status:
Implemented and under active improvement.

Files involved:

- `prometheus-os/`
- `mac-companion/`
- `prometheus-os/backend/`
- `prometheus-os/README.md`

Dependencies:

- local backend
- macOS Companion app
- browser/WebView
- premium TTS providers configured locally
- optional STT providers

Verification completed:

- Commit `e5ac171 feat: add Prometheus OS companion and founder brief system`
- Later Companion routing and intelligence commits `8b5a711`, `6a74e4a`, `2d35b9f`, `71ca278`, `4afa78f`, `cda65b7`

Current limitations:

- Voice behavior depends on macOS permissions, browser/WebView behavior, and local backend health.
- Current worktree contains uncommitted Companion follow-up changes.

Future roadmap:

- Continue improving existing Companion systems only.

Risk level:
Medium.

### 28. Intelligence Orchestrator

Feature Name: Prometheus Intelligence Orchestrator

Purpose:
Route founder reasoning questions through one intelligence layer instead of dashboard cards.

Current Status:
Implemented and founder-accepted previously.

Files involved:

- `prometheus-os/intelligence-orchestrator.js`
- `prometheus-os/companion-command-router.js`
- `prometheus-os/evidence-retriever.js`
- `prometheus-os/evidence-ranker.js`
- `prometheus-os/reasoning-pipeline.js`
- `prometheus-os/llm-context-builder.js`
- `prometheus-os/conversation-memory.js`
- `prometheus-intelligence-orchestrator-report.md`
- `prometheus-intelligence-orchestrator-routing-fix-report.md`

Dependencies:

- memory system
- knowledge graph
- conversation state
- LLM provider
- premium TTS

Verification completed:

- Commit `2d35b9f feat: add Prometheus Intelligence Orchestrator v1`
- Commit `71ca278 fix: complete Prometheus Intelligence Orchestrator routing integration`

Current limitations:

- Companion remains a local founder-only system, not production customer software.
- Stale runtime sync has been a recurring risk.

Future roadmap:

- Keep all future Companion subsystems under Orchestrator control.

Risk level:
Medium.

### 29. Companion Chief of Staff

Feature Name: Daily Chief of Staff / Founder Brief

Purpose:
Give Cruz daily founder priorities, status, risks, and recommended next action.

Current Status:
Implemented and improved.

Files involved:

- `prometheus-os/daily-brief.js`
- `prometheus-os/founder-scorecard.js`
- `prometheus-os/daily-priority-engine.js`
- `prometheus-os/progress-log.js`
- `prometheus-os/github-backup-checklist.js`

Dependencies:

- safe project context
- memory system
- Companion command router
- backend TTS

Verification completed:

- Commits `8b5a711` and `6a74e4a`

Current limitations:

- Depends on local files and current context freshness.

Future roadmap:

- Better automatic synchronization with company state.

Risk level:
Medium.

### 30. Companion Memory / Reasoning

Feature Name: Companion memory and reasoning systems

Purpose:
Make Companion answer from company memory instead of dashboard cards.

Current Status:
Implemented across multiple modules; still actively evolving.

Files involved:

- `prometheus-os/memory-system.js`
- `prometheus-os/memory-ranking.js`
- `prometheus-os/memory-retrieval.js`
- `prometheus-os/retrieval-engine.js`
- `prometheus-os/reasoning-engine.js`
- `prometheus-os/context-search.js`
- `prometheus-os/knowledge-search.js`
- `prometheus-os/knowledge-graph.js`
- `prometheus-os/conversation-state.js`
- `prometheus-os/conversation-context.js`
- `prometheus-os/conversation-manager.js`

Dependencies:

- local documentation
- timeline reports
- knowledge graph
- intent router
- LLM provider

Verification completed:

- Multiple Companion verification scripts and reports exist.

Current limitations:

- Several reasoning/memory files are currently untracked or modified locally, so GitHub may not reflect the latest local experiment.

Future roadmap:

- Consolidate without duplicating.

Risk level:
Medium to High if future work ignores existing modules.

### 31. Mac Companion App

Feature Name: native macOS Companion

Purpose:
Launch and run Prometheus OS locally as a founder-only assistant.

Current Status:
Implemented.

Files involved:

- `mac-companion/`
- `mac-companion/PrometheusCompanion.swift`
- `mac-companion/install-launch-agent.sh`
- `mac-companion/uninstall-launch-agent.sh`
- `mac-companion/start-prometheus-os.sh`

Dependencies:

- macOS permissions
- local backend/server startup
- app icon assets
- user launch behavior preferences

Verification completed:

- Created and iterated across Companion milestones.

Current limitations:

- macOS microphone permissions and speech recognition prompts can require user approval.
- Cruz later chose not to auto-open at login.

Future roadmap:

- Cleaner permission recovery flow.

Risk level:
Medium.

### 32. Premium Voice / TTS Backend

Feature Name: local premium TTS backend

Purpose:
Use premium voice providers without exposing API keys in frontend code.

Current Status:
Implemented locally.

Files involved:

- `prometheus-os/backend/server.js`
- `prometheus-os/backend/tts-provider.js`
- `prometheus-os/backend/openai-tts.js`
- `prometheus-os/backend/elevenlabs-tts.js`
- `prometheus-os/backend/local-env.js`
- `prometheus-os/backend/README.md`

Dependencies:

- local `.env`
- OpenAI or ElevenLabs keys stored locally only
- backend endpoint

Verification completed:

- Voice milestones verified premium voice playback for Companion.

Current limitations:

- Requires local backend running.
- Keys are local and should never be committed.

Future roadmap:

- Harden playback lifecycle and backend health further if needed.

Risk level:
Medium because secrets and local audio state are involved.

### 33. Social Media Manager / Meta Prep

Feature Name: social media manager preparation

Purpose:
Prepare future Instagram/Meta metrics for Prometheus Companion.

Current Status:
Partially built/planned; Meta integration paused.

Files involved:

- `social-media/`
- `prometheus-os/social-media-manager.js`
- likely `.env.example` placeholders

Dependencies:

- Meta Developer setup
- Instagram business account/token
- local `.env`

Verification completed:

- Manual setup was attempted but paused due Meta account registration/security friction.

Current limitations:

- No live token integration should be assumed.
- Meta/Instagram setup is an external blocker.

Future roadmap:

- Resume only when Meta developer setup is stable.

Risk level:
Medium due external auth/token complexity.

### 34. Google Discovery Scripts

Feature Name: backend/local Google discovery scripts

Purpose:
Discover and qualify businesses around a territory using Google services.

Current Status:
Implemented locally.

Files involved:

- `scripts/discover-google-qualified-prospects.mjs`
- `scripts/build-qualified-prospect-routes.mjs`
- `scripts/lib/`
- `data/qualified-prospects/README.md`

Dependencies:

- local `.env`
- Google Places API
- Google Geocoding API

Verification completed:

- Google discovery was completed with local key configured.
- Data pipeline documentation exists.

Current limitations:

- Discovery output may be untracked/local depending on current worktree.
- API key must remain local.

Future roadmap:

- Scheduled backend refresh after backend architecture is approved.

Risk level:
Medium.

### 35. Pilot Package / Chris Outreach

Feature Name: send-ready pilot package for Chris / Fitness Connection leadership

Purpose:
Provide Chris with pilot documents and screenshots.

Current Status:
Created and sent via Gmail during the project.

Files involved:

- `SENDABLE CHRIS PILOT PACKAGE 2026-06-25/` (untracked local folder at inventory time)
- `docs/executive-briefing-packet-chris-dallas.md`
- `docs/prometheus-pilot-approval-package.md`
- `docs/prometheus-pilot-approval-cover-sheet.md`
- related PDF/doc artifacts if generated

Dependencies:

- Gmail connector
- existing pilot docs
- current dashboard screenshot

Verification completed:

- Email was reviewed and sent with Anthony references removed.

Current limitations:

- Local package folder is untracked.

Future roadmap:

- Keep external send packages separate from core source unless intentionally archived.

Risk level:
Low.

### 36. Legal / LLC / Security Documentation

Feature Name: company legal/security docs

Purpose:
Prepare business and security foundation for Prometheus IQ.

Current Status:
Documented.

Files involved:

- `LEGAL/`
- `docs/security-plan.md`
- `docs/security-audit-2026-06-21.md`
- `docs/prometheus-llc-launch-plan.md`

Dependencies:

- founder review
- eventual legal/accounting review

Verification completed:

- Documents exist in repo.

Current limitations:

- Not a substitute for legal counsel.

Future roadmap:

- Formal LLC and legal review.

Risk level:
Medium from business execution standpoint.

### 37. Prometheus Constitution

Feature Name: Prometheus Engineering Constitution

Purpose:
Govern future engineering sessions with existing work verification and seven doctrines.

Current Status:
Implemented and committed.

Files involved:

- `PROMETHEUS_CONSTITUTION.md`

Dependencies:

- future prompt compliance

Verification completed:

- Commit `fa1cba5 docs: establish Prometheus engineering constitution`
- Constitution compliance report exists.

Current limitations:

- Only useful if future sessions actually read and follow it.

Future roadmap:

- Keep stable and do not overload with product-specific details.

Risk level:
Low.

## Engineering Timeline

| Date | Commit | Problem | Solution | Verification | Current Status |
| --- | --- | --- | --- | --- | --- |
| 2026-06-20 | `85d2e99` | Repository needed initialization. | Initialized Prometheus IQ repository. | Git commit exists. | Complete |
| 2026-06-20 | `c05e39b` | Initial Prometheus IQ work needed backup. | Added initial app, docs, deployment, legal/security assets. | Git commit exists. | Complete |
| 2026-06-20 | `4ce23a8` | Field visits needed verified location capture. | Added GPS-aware visit location capture. | Commit and app source changes. | Implemented |
| 2026-06-22 | `a9fd0ed` | Founder operating and pilot readiness materials needed organization. | Added OS/pilot docs and packages. | Git commit exists. | Complete |
| 2026-06-22 | `e9d3b46` | Anthony needed seed routing. | Added Anthony prospect seed routing. | Data/script commit. | Superseded by Google-qualified route work |
| 2026-06-22 | `b0f6295` | Anthony needed private route profile. | Imported Anthony private route profile. | Source/deploy changes. | Implemented |
| 2026-06-22 | `7597756` | Public Prometheus website needed first cinematic version. | Added cinematic website. | Website files committed. | Implemented |
| 2026-06-22 | `2b33c26` | Website scroll overlays were problematic. | Fixed scroll overlays. | Commit exists. | Complete |
| 2026-06-22 | `e091b63` | Website 3D/fallback background was not reliable. | Added animated fallback background. | Commit exists. | Complete |
| 2026-06-22 | `53ec9af` | Hero fire fallback needed visibility. | Added visible hero fire core fallback. | Commit exists. | Complete |
| 2026-06-22 | `00375bf` | Flame direction looked wrong. | Made flame face viewer. | Commit exists. | Complete |
| 2026-06-22 | `e8e8fb6` | Mobile website scroll behavior skipped CTAs. | Fixed mobile scroll behavior. | Commit exists. | Complete |
| 2026-06-23 | `76856ea` | Website hero layout responsive issues. | Fixed responsive hero layout. | Commit exists. | Complete |
| 2026-06-23 | `e16179f` | Request Pilot/View Demo needed premium interactive experiences. | Added interactive website CTA experiences. | Commit exists. | Implemented |
| 2026-06-23 | `ffdcad9` | Website script loading needed external asset. | Loaded public website script externally. | Commit exists. | Complete |
| 2026-06-24 | `4118fef` | Operating system records needed documentation update. | Updated Prometheus OS records. | Commit exists. | Complete |
| 2026-06-24 | `e5ac171` | Founder needed private Companion/OS. | Added Prometheus OS Companion and founder brief system. | Commit exists. | Implemented |
| 2026-06-24 | `8b5a711` | Companion needed better routing and Chief of Staff behavior. | Improved routing and Chief of Staff system. | Commit exists. | Implemented |
| 2026-06-24 | `6a74e4a` | Companion needed smarter founder intelligence. | Improved Chief of Staff intelligence. | Commit exists. | Implemented |
| 2026-06-24 | `2d35b9f` | Companion was card-driven instead of reasoning-driven. | Added Intelligence Orchestrator v1. | Commit exists. | Implemented |
| 2026-06-24 | `363f4fb` | Worktree needed audit. | Added worktree audit report. | Commit exists. | Complete |
| 2026-06-24 | `71ca278` | Real Companion UI still routed founder questions to cards first. | Completed Orchestrator routing integration. | Founder acceptance reported passed. | Implemented |
| 2026-06-25 | `47226a2` | Dashboard metrics needed contextual intelligence. | Added dashboard intelligence engine. | Report records parse/CSP checks. | Implemented |
| 2026-06-25 | `fa1cba5` | Engineering sessions needed stable governance. | Established Constitution. | Commit exists. | Complete |
| 2026-06-25 | `4afa78f` | Companion needed stronger executive reasoning/evidence ranking. | Improved Companion reasoning. | Commit exists. | Implemented |
| 2026-06-26 | `14c5307` | Anthony beta access and route readiness needed stabilization. | Stabilized Anthony beta route intelligence access. | Beta notes record live URL and Cloudflare Access status. | Implemented |
| 2026-06-27 | `cda65b7` | Companion voice startup and beta docs needed stabilization. | Stabilized Companion voice startup and beta verification docs. | Commit exists. | Implemented |
| 2026-06-27 | `6b984a1` | Anthony's localStorage results did not automatically reach Cruz. | Added Copy Today Summary and Export Today Report. | Commit exists. | Implemented |
| 2026-06-27 | `e6a42b1` | Anthony route had invalid/unfindable places. | Hardened route quality validation. | Commit exists. | Implemented |
| 2026-06-27 | `0582d41` | Anthony Day 1 route quality needed final cleanup. | Hardened Anthony Route Intelligence day one quality. | Commit exists. | Implemented |
| 2026-06-27 | `7982a44` | Anthony reset was overwritten by stale startup localStorage. | Fixed startup/profile-switch reset overwrite. | Commit exists. | Implemented |
| 2026-06-27 | `bb98e14` | Founder needed Day 1 reset and route readiness verification. | Reset founder learning and verified route readiness. | Commit exists. | Implemented |
| 2026-06-27 | `9b4cd14` | Release process needed permanent checklist. | Updated release checklist. | Commit exists. | Complete |
| 2026-06-27 | `6a5cd3e` | Route Intelligence V2 needed architecture. | Added V2 architecture. | Commit exists. | Architecture Complete |
| 2026-06-27 | `0a16046` | Continuous learning needed permanent framework. | Added Continuous Learning Framework. | Commit exists. | Architecture Complete |
| 2026-06-28 | `7e1d948` | Founder sync and Anthony nearby opportunities were needed. | Added Nearby Opportunities and production sync safeguards. | Local deploy mirror currently matches source. | Implemented |

## Architecture Document Inventory

| Document | Purpose | Implementation Status | Relationship |
| --- | --- | --- | --- |
| `PROMETHEUS_CONSTITUTION.md` | Permanent engineering governance. | Active governance document. | Must be read before future engineering. |
| `docs/route-intelligence-v2-architecture.md` | Design why-based learning for Route Intelligence. | Architecture Complete. | Extends current route engine. |
| `docs/continuous-learning-framework.md` | Define safe long-term learning from field evidence. | Architecture Complete. | Extends Route Intelligence V2. |
| `docs/prometheus-release-checklist.md` | Permanent release and verification procedure. | Active checklist. | Required before beta/production links. |
| `dashboard-intelligence-report.md` | Documents dashboard intelligence improvements. | Implemented. | Explains current dashboard scoring/metrics. |
| `prometheus-route-intelligence-quality-report.md` | Documents quality scoring for Google route candidates. | Implemented as quality pass/report. | Supports route quality decisions. |
| `data/qualified-prospects/README.md` | Explains prospect discovery, Google workflow, and route rules. | Active data process. | Guides Google-qualified route generation. |
| `docs/beta-sharing-plan.md` | Documents beta sharing, Cloudflare Access, Google verification, Anthony feedback. | Active beta procedure. | Guides private beta onboarding. |
| `docs/google-places-integration-readiness-plan.md` | Initial Google Places readiness/security architecture. | Superseded by implemented local Google discovery, still useful. | Historical Google plan. |
| `prometheus-intelligence-orchestrator-report.md` | Documents Companion Orchestrator v1. | Implemented for Companion. | Founder-only system. |
| `prometheus-intelligence-orchestrator-routing-fix-report.md` | Documents real UI routing fix. | Implemented for Companion. | Prevents card response hijack. |
| `prometheus-companion-full-diagnostic-report.md` | Companion health diagnostic. | Report/diagnostic. | Founder-only operational reference. |
| `prometheus-worktree-audit-report.md` | Prior worktree inventory/security audit. | Complete. | Repository hygiene reference. |
| `docs/prometheus-disaster-recovery-plan.md` | Disaster recovery guidance. | Documentation. | Continuity support. |
| `docs/prometheus-founder-continuity.md` | Founder continuity guidance. | Documentation. | Continuity support. |
| `COMPANY_IDENTITY.md` | Canonical company mission, vision, values, positioning, and permanent identity decisions. | Active identity source. | Must be reused by Website, Sales, Research, Social Media, and investor/customer-facing work. |
| `docs/prometheus-company-manual.md` | Company operating manual. | Documentation. | Business continuity. |
| `docs/prometheus-founder-operating-system.md` | Founder operating system concept. | Documentation. | Companion/OS context. |
| `docs/prometheus-origin-story-development-history.md` | Origin story/development history. | Documentation. | Memory and founder context. |
| `docs/prometheus-routeiq-cta-experience-upgrade.md` | Public website CTA interaction design. | Implemented in public site. | Marketing site reference. |
| `docs/public-site-cloudflare-readiness.md` | Public site deployment readiness. | Documentation. | Public website release context. |
| `docs/pilot-support-system.md` | Pilot support structure. | Documentation. | Pilot operations reference. |
| `docs/business-pilot-discovery-and-demo-dashboard-process.md` | Pilot discovery/demo process. | Documentation. | Sales/pilot context. |

## Major Commit Summary

| Commit | Purpose | Current Production Status |
| --- | --- | --- |
| `c05e39b` | Initial Prometheus IQ backup. | Historical foundation. |
| `4ce23a8` | Verified visit location capture. | Implemented. |
| `b0f6295` | Anthony private route profile. | Implemented but superseded by Google-qualified route improvements. |
| `7597756` | Cinematic public website. | Implemented separately from dashboard. |
| `e16179f` | Interactive public website CTA experiences. | Implemented. |
| `e5ac171` | Prometheus OS Companion and founder brief system. | Implemented founder-only. |
| `2d35b9f` | Intelligence Orchestrator v1. | Implemented founder-only. |
| `71ca278` | Orchestrator routing integration fix. | Implemented founder-only. |
| `47226a2` | Dashboard Intelligence Engine. | Implemented. |
| `fa1cba5` | Prometheus Constitution. | Active governance. |
| `14c5307` | Anthony beta route intelligence access. | Implemented. |
| `6b984a1` | Beta-safe rep daily handoff. | Implemented. |
| `e6a42b1` | Anthony route quality validation. | Implemented. |
| `0582d41` | Anthony Day 1 route quality hardening. | Implemented. |
| `7982a44` | Anthony learning reset startup overwrite fix. | Implemented. |
| `bb98e14` | Founder reset and route readiness. | Implemented. |
| `9b4cd14` | Release verification checklist. | Active documentation. |
| `6a5cd3e` | Route Intelligence V2 architecture. | Architecture Complete. |
| `0a16046` | Continuous Learning Framework. | Architecture Complete. |
| `7e1d948` | Nearby Opportunities and production sync safeguards. | Implemented in source and deploy mirror. |

## Known Issues

### Verified Production Issues

No verified unresolved production blocker was confirmed during this inventory pass.

Items that require future live verification, not assumptions:

- Authenticated Cloudflare production must be inspected after each release.
- Founder Home Screen/PWA must be refreshed after deployment to confirm service worker update.
- Anthony's actual device must be checked after beta changes because localStorage and Cloudflare Access sessions are device-specific.

### Known Limitations

- Representative data is localStorage-first. Cruz receives Anthony data only through Copy Today Summary or Export Today Report unless a backend sync is added later.
- Cloudflare Email One-Time PIN can fail if a tester uses an old code, stale tab, or old challenge.
- Google-qualified route data is embedded from a discovery snapshot, not dynamically refreshed from Google in the live browser.
- Route Intelligence can estimate confidence but cannot prove representative DNA until enough real field outcomes are collected.
- Companion voice quality and microphone behavior depend on local macOS/WebView permissions and backend health.
- Founder and Anthony reset logic depends on app build/version migration reaching the user's browser or Home Screen app.
- Public website, private Prometheus IQ dashboard, and private Companion are separate surfaces and can be confused in future prompts.

### Intentional Future Work

- Secure backend sync for representative field data.
- Owner-visible live beta reporting.
- Route Intelligence V2 implementation.
- Continuous Learning implementation.
- Representative DNA implementation.
- Event Intelligence architecture and implementation.
- Social Media Manager/Instagram integration after Meta setup is unblocked.
- Multi-location manager onboarding.
- ZIP/territory planning automation.
- Google Places refresh scheduling.

## Technical Debt

Only genuine technical debt is listed here. Planned features are not included.

1. Monolithic dashboard file

`index.html` contains UI, state, data, routing, rendering, learning, export, and profile logic. This made fast iteration possible but increases regression risk.

Risk: Medium to High.

2. Manual source-to-deploy mirroring

`index.html` must match `deploy/cloudflare-pages/index.html`; `sw.js` must match `deploy/cloudflare-pages/sw.js`; `_headers` must match `deploy/cloudflare-pages/_headers`.

Risk: Medium.

3. localStorage migration complexity

Founder/Anthony resets and profile loading require careful startup ordering. This has already caused a verified bug.

Risk: Medium.

4. Embedded Google-qualified data

Google route data is currently embedded in the dashboard instead of served through a backend API.

Risk: Medium.

5. Manual beta data handoff

Copy/export is intentionally low risk, but it is not scalable.

Risk: Medium.

6. Companion duplicate/overlapping reasoning files

Companion has multiple memory/retrieval/reasoning modules, and some are currently untracked/modified. Future work must avoid creating another reasoning layer.

Risk: Medium.

7. Workspace artifact clutter

The repo/workspace contains demos, screenshots, wallpapers, generated previews, sendable packages, and local reports. This increases staging mistakes.

Risk: Medium.

8. Cloudflare live verification remains manual

Deployment package parity does not prove live authenticated production parity.

Risk: Medium.

9. Multiple pilot/business docs overlap

Several pilot and executive documents cover similar ground. Useful, but can confuse future send packages.

Risk: Low to Medium.

10. Public website and product dashboard share brand but not release flow

Future prompts can accidentally deploy or edit the wrong surface.

Risk: Medium.

## Future Ideas Catalog

These ideas are documented or discussed but should not be re-requested as if no prior work exists.

- Nearby Opportunities: Implemented v1 in `7e1d948`; future improvement is live/backend refresh and field validation.
- Category weighting: Documented in Route Intelligence V2 and Continuous Learning.
- Representative DNA: Architecture complete, not fully implemented.
- Continuous Learning: Architecture complete, not implemented as mature production learning.
- Event Intelligence: Future idea; not implemented.
- Event admission info: Future idea; not implemented.
- Opportunity Radius: Nearby Opportunities v1 covers a 500-foot beta version.
- Manager Intelligence: Future idea tied to owner mode and multi-rep reporting.
- Multi-location onboarding: documented in release/data notes; not fully implemented.
- ZIP/territory planning: documented as future planning.
- Social Media Manager: prep exists; Meta integration paused.
- Gmail/email assistant: Companion drafting mode exists conceptually; sending integrations should remain explicit.
- Secure cloud sync: highest logical future data-flow upgrade, but not implemented.
- Backend Google refresh: planned future architecture.
- Owner-visible Anthony reporting: not centralized yet.
- Referral program: marketing/business future idea, not core app implementation.

## Duplicate Work Analysis

This section should be read before future Codex prompts.

### Work Already Completed

- Core dashboard exists in `index.html`.
- Rep mode exists.
- Owner mode exists.
- Route Intelligence exists.
- Dashboard Intelligence Engine exists.
- Google-qualified route data exists.
- Google route quality gates exist.
- Anthony profile exists.
- Founder profile exists.
- Anthony learning reset exists.
- Founder learning reset exists.
- Copy Today Summary exists.
- Export Today Report exists.
- Nearby Opportunities v1 exists.
- Release checklist exists.
- Cloudflare beta procedure exists.
- Public website exists.
- Request Pilot and View Demo CTA experiences exist.
- Companion exists.
- Intelligence Orchestrator exists.
- Companion Chief of Staff exists.
- Route Intelligence V2 architecture exists.
- Continuous Learning Framework exists.
- Constitution exists.

### Work Partially Completed

- Representative learning: current beta learning exists; V2 is architecture-ready but not fully implemented.
- Representative DNA: architecture exists; production model not complete.
- Google discovery: local/backend script exists; live dashboard uses embedded qualified output.
- Companion memory/reasoning: implemented but actively evolving, with local uncommitted changes.
- Social Media Manager: prep exists; Meta integration blocked.
- Owner-visible reporting: owner mode exists, but remote rep data is not centralized.

### Work Documented But Not Implemented

- Continuous Learning evidence buckets.
- Mature confidence model.
- durable Representative DNA.
- Event Intelligence.
- admission info for event recommendations.
- cloud-synced learning.
- secure backend data store.
- manager intelligence for multi-location rollouts.
- scheduled Google refresh.
- Meta/Instagram metrics integration.

### Work Requested Multiple Times

- Companion reasoning replacing card behavior.
- Anthony access and Cloudflare OTP.
- Google-qualified Route Intelligence.
- Anthony reset.
- Founder reset.
- Route quality invalid-place fixes.
- Copy/export handoff.
- Public website hero/3D fixes.
- Prometheus Companion startup/voice reliability.
- GitHub backup/audits.
- Constitution/compliance.

### Potential Duplicate Engineering Effort

Avoid creating a new:

- dashboard
- route engine
- learning engine
- representative profile system
- export system
- Companion reasoning engine
- Google discovery system
- Cloudflare Access app
- public website deployment path
- pilot package

Improve existing files and documents instead.

### Potential Unnecessary Codex Usage

Before asking Codex to build anything, Cruz should check:

1. `PROMETHEUS_CONSTITUTION.md`
2. this inventory
3. `docs/prometheus-release-checklist.md`
4. `docs/route-intelligence-v2-architecture.md`
5. `docs/continuous-learning-framework.md`
6. `dashboard-intelligence-report.md`
7. `docs/beta-sharing-plan.md`

Most repeated requests have already been implemented or documented.

## Readiness Matrix

| System | Status | Notes |
| --- | --- | --- |
| Constitution | Production Ready | Governance document committed. |
| Core dashboard | Production Ready | Current local and deploy source match. |
| Rep Mode | Verified | Must be checked each release. |
| Owner Mode | Verified | Founder reset implemented. |
| Route Intelligence | Production Beta Ready | Google-qualified route engine hardened. |
| Google-qualified route data | Verified / Production Beta Ready | Embedded qualified output; API key remains local. |
| Google live refresh | Not Started | Future backend work. |
| Google Directions | Verified | Requires ongoing live checks. |
| quarantine rules | Implemented | Must be maintained with new territories. |
| duplicate protection | Implemented | Depends on place identity quality. |
| Nearby Opportunities | Implemented | Needs more field validation. |
| Copy Today Summary | Verified | Manual beta handoff. |
| Export Today Report | Verified | Manual beta handoff. |
| centralized rep data sync | Not Started | Biggest data-flow limitation. |
| Anthony profile | Verified | Reset/startup bug fixed. |
| Founder profile | Verified | Day 1 reset implemented. |
| Representative DNA | Architecture Complete | Not production model yet. |
| Continuous Learning | Architecture Complete | Not production model yet. |
| Route Intelligence V2 | Architecture Complete | Future implementation phases documented. |
| Cloudflare Access | Implemented | OTP friction documented. |
| Cloudflare live deployment | In Progress / Requires Live Auth Verification | Package matches local, but live auth must be checked after releases. |
| Service worker/PWA sync | Implemented | Home Screen app can cache old build until refreshed. |
| Public website | Implemented | Separate from dashboard. |
| Request Pilot CTA | Implemented | No backend lead capture yet. |
| View Demo CTA | Implemented | Marketing demo only. |
| Companion | In Progress | Founder-only, useful, still evolving. |
| Intelligence Orchestrator | Implemented | Founder-accepted for card bypass issue. |
| Companion voice | In Progress | Local permissions/backend sensitive. |
| Social Media Manager | In Progress / Blocked | Meta setup paused. |
| Event Intelligence | Not Started | Future idea. |
| multi-location onboarding | Architecture/Docs | Not full product flow yet. |
| release checklist | Verified | Active permanent procedure. |
| disaster recovery docs | Documentation | Existing, should be kept current. |
| founder continuity docs | Documentation | Existing, should be kept current. |

## Security Review

Security-sensitive findings:

- `.env` files exist locally and must not be read, printed, staged, or committed.
- Google, OpenAI, ElevenLabs, Meta, Cloudflare, GitHub, and other keys must remain local/backend-only.
- No secret values are included in this inventory.
- Current dirty worktree includes untracked files and should be reviewed before any future commit.
- `prometheus-os/backend/.env` exists and was not opened for this inventory.

Security controls already documented:

- `.env` ignored and local-only.
- Google key not in frontend.
- Cloudflare Access protects beta URLs.
- release checklist requires no secrets, screenshots, generated audio, wallpapers, or `.env` files staged.
- Companion backend provider files use local env configuration.

## Deployment Inventory

Current local deployment package source:

- `deploy/cloudflare-pages/index.html`
- `deploy/cloudflare-pages/sw.js`
- `deploy/cloudflare-pages/_headers`
- `deploy/cloudflare-pages/manifest.webmanifest`

Current parity checks:

- `index.html` vs `deploy/cloudflare-pages/index.html`: match
- `sw.js` vs `deploy/cloudflare-pages/sw.js`: match
- `_headers` vs `deploy/cloudflare-pages/_headers`: match

Known deployment principle:

Local/package parity is not enough. Live authenticated Cloudflare production must be inspected after deployment, especially for PWA/service-worker-sensitive changes.

## Documentation Summary

Stable high-value documents:

- `PROMETHEUS_CONSTITUTION.md`
- `PROMETHEUS_IQ_ENGINEERING_MASTER_INVENTORY.md`
- `docs/prometheus-release-checklist.md`
- `docs/route-intelligence-v2-architecture.md`
- `docs/continuous-learning-framework.md`
- `docs/beta-sharing-plan.md`
- `data/qualified-prospects/README.md`
- `dashboard-intelligence-report.md`
- `prometheus-route-intelligence-quality-report.md`
- `docs/prometheus-disaster-recovery-plan.md`
- `docs/prometheus-founder-continuity.md`
- `docs/prometheus-company-manual.md`

Documents that are useful but likely historical/supplemental:

- `docs/google-places-integration-readiness-plan.md`
- `docs/prometheus-enterprise-product-audit-2026-06-22.md`
- `prometheus-worktree-audit-report.md`
- `prometheus-companion-full-diagnostic-report.md`
- `prometheus-cognitive-engine-report.md`
- `prometheus-reasoning-engine-report.md`

Documents/folders needing future review before commit:

- untracked Companion reports
- untracked social-media files
- untracked Chris pilot package
- demo/prototype folders
- desktop wallpapers
- screenshots/previews

## Known Source Surfaces

Prometheus IQ production beta:

- `index.html`
- `deploy/cloudflare-pages/index.html`

Public marketing website:

- `deploy/prometheusrouteiq-website/`

Founder Companion:

- `prometheus-os/`
- `mac-companion/`

Google discovery:

- `scripts/discover-google-qualified-prospects.mjs`
- `scripts/lib/`
- `data/qualified-prospects/`

Release docs:

- `docs/prometheus-release-checklist.md`
- `docs/beta-sharing-plan.md`

Governance:

- `PROMETHEUS_CONSTITUTION.md`
- this inventory

## Most Important Recommendation

Before approving the next engineering sprint, Cruz should review:

1. the Readiness Matrix in this document,
2. the Duplicate Work Analysis,
3. `docs/prometheus-release-checklist.md`,
4. the Known Limitations section,
5. `docs/route-intelligence-v2-architecture.md`,
6. `docs/continuous-learning-framework.md`.

The decision Cruz should make before the next sprint is informational, not coding: choose whether the next approved sprint is primarily about live field validation using the current beta, or about solving the biggest known limitation: secure owner-visible data synchronization beyond Copy Today Summary and Export Today Report.

## Final Notes For Future Prompts

Future prompts should specify which surface is being changed:

- Prometheus IQ dashboard
- public PrometheusRouteIQ website
- Founder Companion / Prometheus OS
- Cloudflare Access/deployment
- Google discovery pipeline
- documentation only

Future prompts should also explicitly state whether the task is:

- implementation
- architecture only
- audit only
- release verification
- documentation
- field feedback review

This will prevent repeat work and protect Codex time.

PROMETHEUS IQ MASTER ENGINEERING INVENTORY

Status: Complete
