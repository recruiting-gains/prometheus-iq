# Prometheus Route IQ

Prometheus Route IQ is Prometheus.IQ's governed field-decision intelligence product for outside-sales organizations. It helps an authorized representative decide where to go, understand why a stop is eligible, record what happened, and preserve evidence for human review. AI assists; humans decide.

## Live Architecture

- **Public Worker:** `prometheusrouteiq-website` serves the public website, legal pages, assets, and governed Route IQ request intake. It must not expose private workspace behavior.
- **Private Worker:** `prometheus-iq` serves authenticated Founder, customer, manager, and representative workflows. Server-side role, workspace, and tenant checks are authoritative.
- **CRM:** public intake persists before notification. Founder retrieval and export remain protected. CRM records are not engineering fixtures and must not be mutated without explicit production authorization.
- **Route intelligence:** recommendations are explainable, evidence-bound, and advisory. Missing, stale, review-required, or unauthorized evidence fails closed. Collection, cohorts, provider refresh, scheduling, and recommendation influence are independent controls.

### Intelligence Reuse Rules

The existing **Adaptive Outside Sales Intelligence Engine** is authoritative: **Do not create a second learning engine**. The **Field Learning Loop rule** is to extend the governed loop, the **Offline learning validation rule** is to reuse its evidence harness, the **Recommendation explainability rule** is to reuse the current explanation engine, the **Operating Profile rule** is to add industries through validated profiles, the **Customer Intelligence Graph rule** is to extend the tenant-bound graph, and the **Continuous route replenishment rule** is to extend the existing advisory replenishment path. These are duplicate-prevention rules, not activation authority.

Git `main` is source authority. GitHub runs and immutable artifacts are qualification authority. Cloudflare is runtime authority. Dynamic Worker versions and traffic allocations must be queried rather than copied into this document.

## Authority Map

- [Product Vision](PRODUCT_VISION.md) owns company identity, product direction, brand, approved messaging, and durable claims.
- Patent and legal authorities under [`patents/`](patents/) and [`legal/`](legal/) own invention, disclosure, trademark, copyright, and other protected evidence.
- [AGENTS.md](AGENTS.md) routes engineering execution.
- [Test and Release Map](docs/TEST_RELEASE_MAP.md) defines active suites and qualification lanes.

Do not use historical engineering reports, superseded governance records, or deployment mirrors as current authority. Retired files remain recoverable from Git through [`overwatch/retirement/phase-1-retirement-manifest.json`](overwatch/retirement/phase-1-retirement-manifest.json).

## Repository Boundaries

**Source:** `src/`, `workers/`, `dashboard/`, `data/`, `intelligence/`, `crm/`, `administration/`, `security/`, `integrations/`, `social-media/`, `scripts/`, and active configuration at the repository root.

**Derived deployment mirrors:** `dist-public/`, `deploy/prometheusrouteiq-website/`, and `deploy/cloudflare-pages/`. Read or modify them only for build, qualification, packaging, rollback, or production-impact work. They are not independent product authority.

**Deferred dead entrypoint:** `landing.js` and its GSAP lock remain preserved because the current verified public forward-rollback build is pinned to that exact dependency graph. They are not the Vite entrypoint; removal requires a successor rollback package.

**Dormant source:** `mac-companion/` and `prometheus-os/`. Preserve them, but do not include them in ordinary builds or active qualification unless a specifically authorized task reactivates them.

**Historical evidence:** dated reports, receipts, prior release records, field-session archives, and legal/IP evidence. Read them only when the task requires their exact history. Never rewrite or use them as changing production state.

Production customer data, CRM data, private exports, credentials, secret values, `.wrangler`, and `.founder-review` are outside ordinary repository work. Never commit them.

## Minimum Engineering Route

1. Read only this file, `AGENTS.md`, `docs/TEST_RELEASE_MAP.md`, and task-owned files.
2. Classify the change as control-plane, public runtime, private runtime, shared runtime, or historical/manual.
3. Run the mapped local suite once, build each affected artifact once, and prove the relevant security and rollback boundary.
4. Commit and push normally, then qualify the exact commit and tree through the one correct hosted lane.
5. Deploy only an explicitly authorized, downloaded, digest-verified artifact through its protected application-specific workflow.

Ordinary social content is owned externally by Meta AI. The repository retains only deployed Instagram integration, attribution, privacy, and security code. Reddit assistance is Founder-initiated, attended, read-only advisory research under the limits in `AGENTS.md`.
