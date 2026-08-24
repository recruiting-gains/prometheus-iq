# Customer Success & Enterprise Pipeline Foundation v2

## Purpose

Prometheus CRM v2 prepares the CRM subsystem to manage the full customer lifecycle after route activity creates business evidence. It extends the beta contact/follow-up foundation into an account operating system for pilot companies, enterprise opportunities, customer onboarding, customer success, expansion, renewal, and executive relationship management.

This architecture is planning and CRM-owned operating structure only. It does not modify Dashboard, Companion, Infrastructure, Data, or the Intelligence Engine.

## Sources Read

- `AGENTS.md`
- `README.md`
- `PRODUCT_VISION.md`
- `sales/README.md`
- `sales/customer-success-lifecycle.md`
- `crm/README.md`
- `crm/crm-foundation.mjs`

Root `PRODUCT_VISION.md` is now the canonical product vision source. `SALES_FOUNDATION.md` was not present, so CRM used the committed `sales/` foundation as the approved fallback source.

## CRM Boundary

CRM owns the internal system of record for accounts, contacts, opportunities, activity, onboarding, customer health, expansion, renewal, and relationship history.

CRM does not own:

- Dashboard UI or beta runtime behavior.
- Companion behavior or memory/reasoning implementation.
- Infrastructure, authentication, deployment, or storage provisioning.
- Data sourcing, route pools, Google Places refresh, or data quality governance.
- Intelligence Engine scoring or recommendation logic.
- Sales narrative, outbound sales strategy, or customer-facing proposal language.
- External communication providers or message sending.

## Account Scale Model

CRM must support four operating levels:

| Scale | CRM Need | Operating Standard |
| --- | --- | --- |
| 1 company | Founder-visible account record and beta/pilot status | Manual accuracy, clear timeline, no duplicate notes |
| 10 companies | Repeatable pilot/customer-success pipeline | Shared stage definitions, task queues, health snapshots |
| 100 companies | Portfolio-level account operations | Account hierarchy, risk filters, renewal views, owner assignment |
| enterprise deployments | Multi-location, regional, and executive governance | Company/district/location hierarchy, sponsors, milestones, adoption and renewal discipline |

## Core Entity Model

### Company Account

The parent record for an organization. A company account stores account type, lifecycle stage, industry, territory, account owner, company hierarchy, executive sponsor map, health score, timeline, active opportunities, renewal state, and customer success owner.

Account types:

- `beta_company`
- `pilot_company`
- `customer`
- `enterprise_customer`
- `partner`
- `closed_lost_account`

Lifecycle stages:

- `identified`
- `beta_active`
- `pilot_scoping`
- `pilot_active`
- `implementation`
- `active_customer`
- `expansion`
- `renewal`
- `at_risk`
- `closed_lost`

### Contacts And Decision Makers

Contacts stay separate from accounts so one account can contain local managers, regional leaders, executives, field users, procurement contacts, legal/security contacts, and champions.

Decision-maker roles:

- `economic_buyer`
- `executive_sponsor`
- `pilot_owner`
- `field_manager`
- `rep_champion`
- `procurement`
- `legal_security`
- `technical_owner`

### Enterprise Opportunities

Opportunities represent commercial motion tied to an account. A single account may have a beta opportunity, a pilot opportunity, a paid deployment opportunity, an expansion opportunity, and a renewal opportunity over time.

Opportunity stages:

- `discovery`
- `qualified`
- `pilot_proposed`
- `pilot_approved`
- `pilot_active`
- `business_review`
- `proposal`
- `procurement`
- `won`
- `lost`

### Customer Success Record

Customer success stores adoption, outcomes, user friction, support issues, manager feedback, executive alignment, health score, active milestones, renewal confidence, expansion readiness, and next action.

This record must link back to account timeline events, meeting history, product adoption snapshots, support issues, and commercial opportunities.

## Account Hierarchy

CRM must support multi-location organizations without flattening them into one location record.

Hierarchy levels:

- `company`
- `region`
- `district`
- `market`
- `location`
- `team`
- `rep`

Hierarchy nodes need parent-child relationships, owner assignment, territory labels, status, adoption summary, and location count rollups.

## Timeline And Meeting History

Every account should have a chronological timeline containing:

- Account creation.
- Contact/decision-maker changes.
- Route/beta activity imported from CRM v1 records.
- Discovery calls.
- Pilot approvals.
- Onboarding events.
- Product adoption checkpoints.
- Customer success reviews.
- Executive business reviews.
- Expansion discussions.
- Renewal events.
- Risk escalations.
- Closed-lost reasons.

Meeting history should record date, participants, account stage, purpose, decisions, objections, commitments, next steps, and linked follow-up tasks.

## Product Adoption Tracking

CRM tracks adoption outcomes. It does not compute route recommendations or duplicate Intelligence Engine logic.

Adoption snapshots should support:

- Active users.
- Active reps.
- Active managers.
- Locations active.
- Visits logged.
- Follow-ups created.
- Tasks completed.
- Reporting cadence met.
- Product friction notes.
- Outcome proof notes.

Dashboard may later display this data only through a Dashboard-owned handoff. CRM v2 does not modify Dashboard.

## Success Milestones

Milestones represent agreed proof points for customer value.

Default milestone categories:

- `beta_started`
- `first_verified_visit`
- `first_follow_up_created`
- `first_manager_review`
- `pilot_launch`
- `weekly_success_review`
- `monthly_business_review`
- `first_expansion_signal`
- `renewal_review`
- `customer_success_confirmed`

Milestones must have owner, due date, completed date, evidence note, and account impact.

## Customer Health Scoring

CRM health is an operations signal, not an Intelligence Engine recommendation. The score should be transparent and based on customer lifecycle evidence.

Default dimensions:

- Adoption.
- Field activity.
- Outcome proof.
- Executive alignment.
- Renewal risk.
- Support load.
- Data completeness.

Health bands:

- `healthy`: account is adopting, outcomes are visible, and renewal risk is low.
- `watch`: account has missing evidence, slow adoption, weak executive engagement, or unresolved friction.
- `at_risk`: account has low adoption, poor outcomes, unresolved blockers, or renewal risk.

## Expansion And Renewal

Expansion opportunities should be created only when the account has evidence of adoption, outcome proof, executive interest, or a specific new market/team need.

Renewal lifecycle:

- 120 days before renewal: confirm health, adoption, and success evidence.
- 90 days before renewal: review usage, outcomes, risks, and expansion path.
- 60 days before renewal: executive business review.
- 45 days before renewal: commercial proposal.
- 30 days before renewal: procurement/legal close.

## Reporting Architecture

CRM v2 should eventually report:

- Active beta companies.
- Active pilot companies.
- Enterprise opportunities by stage.
- Accounts by health band.
- At-risk accounts.
- Upcoming renewals.
- Expansion opportunities.
- Executive relationships needing attention.
- Meetings without next steps.
- Success milestones due/overdue.
- Adoption snapshots by company, region, district, and location.

## Duplicate Prevention

Do not duplicate:

- Sales operating-system documents in `sales/`.
- Dashboard runtime, route, or UI logic.
- Companion memory, routing, or reasoning behavior.
- Infrastructure auth, deployment, storage, or provider setup.
- Data runtime pools, prospect refresh, or quality governance.
- Intelligence Engine scoring, route generation, or recommendations.
- External communication provider integrations.

Reuse:

- `crm/crm-foundation.mjs` for beta CRM contact/lead/follow-up/task primitives.
- `sales/customer-success-lifecycle.md` for Sales-owned customer success operating language.
- `PRODUCT_VISION.md` for company identity, product promise, and long-term product direction.
- `README.md` for completed work and duplicate-prevention references.

## Future Handoffs

- Dashboard: only when CRM reporting should be surfaced in product UI.
- Infrastructure: only when CRM needs secure backend persistence, auth, roles, or tenant isolation.
- Data: only when account records need production data import/export or governed sync.
- Intelligence Engine: only when CRM health or adoption signals should inform recommendations.
- Sales: only when CRM account fields require customer-facing sales process changes.
- Administration: only when beta tester/pilot company administration records need reconciliation.
