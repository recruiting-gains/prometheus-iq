# Route IQ August 1 Production Activation v1

Document ID: `route-iq-2026-08-01-production-activation-v1`
Owner: Prometheus Administration
Activation date: August 1, 2026
Status: controlling launch-operations package; execution remains Founder-authorized
Product state: production activation, not beta

## Purpose

This package is the controlling operating checklist for the bounded August 1 Route IQ production activation. It coordinates owner-produced evidence without granting access, deploying software, changing production data, contacting customers, or activating a customer by itself.

The package covers:

1. August 1 production launch checklist.
2. Customer activation checklist.
3. Named-user provisioning procedure.
4. Two-company and 40-user enforcement procedure.
5. Founder acceptance script.
6. Customer onboarding script.
7. PWA installation instructions.
8. Production monitoring checklist.
9. Incident and rollback runbook.
10. Support triage procedure.
11. Known limitations list.
12. Launch-day go/no-go checklist.
13. Post-launch 24-hour and seven-day verification plan.

## Controlling Launch Contract

The August 1 activation is bounded by all of the following:

- Cruz Garza is the only authorized human acceptance tester before launch.
- No external human tester may receive prelaunch access.
- Anthony remains unmapped and has no access.
- No more than two customer companies may be activated.
- No more than 40 named customer users may be admitted across both companies.
- Route IQ uses one generic PWA. No customer-specific build, application, or code fork is allowed.
- Prospective collection remains `OFF`.
- Active prospective cohorts remain `0`.
- Recommendation influence remains `OFF`.
- Representative-facing shadow output remains prohibited.
- Production activation does not prove recommendation superiority, causal uplift, or performance across industries.
- Any scope expansion requires a separate Founder decision.

If any controlling state is unknown or cannot be proved from current owner evidence, the launch decision is `NO-GO`.

## Historical Documents Are Noncontrolling

Historical beta, pilot, and tester records remain preserved exactly as evidence. They do not authorize an August 1 user, company, deployment, production mutation, support commitment, retention choice, or product claim.

The following are explicitly noncontrolling for the August 1 activation:

- `docs/beta-sharing-plan.md`
- `docs/pilot-support-system.md`
- beta-specific sections of `docs/prometheus-release-checklist.md`
- `docs/prometheus-pilot-execution-playbook.md`
- `docs/cloud-beta-cost-and-response-plan.md`
- `administration/README.md` section `Current Beta Truth`
- `administration/registers/beta-testers.json`
- `administration/registers/pilot-companies.json`
- `administration/verification/beta-stabilization-sprint-1/`
- `administration/command-center/beta-sprint-2/`

Reusable procedures from those sources may be incorporated only when this package or a current owner document restates them in production language. Historical references to Anthony, Fitness Connection as a pilot company, private beta, wider beta, tester activation, or beta SLAs do not control this launch.

## Owner Documents

- Administration master package: this file.
- Production support triage: `administration/workflows/route-iq-production-support-triage-v1.md`.
- Provisioning, monitoring, incident, and rollback: `docs/route-iq-production-provisioning-monitoring-incident-rollback-v1.md`.
- Generic PWA installation and recovery: `docs/route-iq-pwa-installation-and-recovery-v1.md`.
- Customer onboarding: `sales/route-iq-customer-onboarding-v1.md`.
- Product limitations: `docs/route-iq-production-known-limitations-v1.md`.

Missing owner evidence fails closed. Administration may coordinate and record these artifacts but may not replace an owner decision or implementation.

## Required Founder Decisions

The Founder must explicitly decide or approve each of the following before activation:

- Exact customer company roster, with zero to two companies.
- Exact named-user roster, with zero to 40 customer users total.
- Each user's company, operating profile, role, territory, and immutable authenticated principal mapping.
- Launch date and customer-specific activation window.
- Which customer users, if any, are activated on August 1 rather than later.
- Customer support channel, support hours, and named support owner.
- Customer escalation contact and Prometheus escalation contact.
- Customer success measurements and review cadence.
- Any customer retention period shorter than the governed 18-month maximum.
- Any production acceptance action that creates or changes a record.
- Final `GO` or `NO-GO` decision.
- Any deployment, access-policy mutation, production-data repair, rollback deployment, or launch-scope expansion.

Silence, an incomplete roster, a display name, an email address without immutable-principal verification, a sales conversation, or an unsigned customer statement is not approval.

## Required Customer Decisions

Each customer must supply or approve, through an authorized decision-maker:

- Legal or operating company identity used for the Route IQ workspace.
- Authorized territory, locations, and operating profile.
- Exact named-user roster and role assignment.
- Customer manager and escalation contact.
- Permitted field data and prohibited data.
- Device ownership and PWA installation policy.
- Success measurements and review cadence.
- Support contact method and support hours acknowledgment.
- Retention disclosure and any requested shortening of the maximum period.
- Start date, end or review date, and stop conditions.
- Written authorization to activate production access.

Customer approval cannot expand the two-company, 40-user, safety-state, privacy, retention, intelligence, or deployment boundaries. A requested expansion requires a separate Founder directive.

## Two-Company And 40-User Control

Before every user admission, Administration and Infrastructure must reconcile the same roster against the canonical Data-owned workspace configuration and authenticated-access mapping.

Count rules:

- A company counts when it is approved for activation, pending access, onboarding, active, or paused with retained access identity.
- A user counts when the named principal is approved, pending access, onboarding, active, or paused with retained access identity.
- Duplicate entries for the same immutable principal are a blocking conflict, not a way to reduce the count.
- Removed users stop counting only after owner evidence proves access removal and the Administration record is closed.
- Synthetic fixtures, Founder research workspaces, historical workspaces, and Cruz's Founder acceptance identity are not customer companies or customer users.
- Anthony is not a customer user and must remain unmapped.

Admission fails closed when:

- the company count would exceed two;
- the named customer-user count would exceed 40;
- Data and Infrastructure counts differ;
- a principal, workspace, operating profile, role, or territory is missing or ambiguous;
- one identity maps to more than one company;
- an inactive, historical, synthetic, or Founder-research workspace is proposed as a customer workspace;
- a display name or email alone is used as authorization.

Launch-day recorded counts:

```text
Approved customer companies: ____ / 2
Approved named customer users: ____ / 40
Canonical Data roster evidence: ____________________
Infrastructure access-map evidence: ____________________
Count reconciliation: PASS / FAIL
Reviewed by: ____________________
Reviewed at: ____________________
```

## Customer Activation Checklist

Complete once for each customer company. Activation is prohibited until every required item passes.

### Business Authorization

- [ ] Authorized customer decision-maker identified.
- [ ] Written production activation authorization recorded outside public source files.
- [ ] Workspace and operating profile approved.
- [ ] Territory and location scope approved.
- [ ] Start date and review date approved.
- [ ] Success measurements approved.
- [ ] Permitted and prohibited data documented.
- [ ] Retention disclosure accepted; any shortening recorded.
- [ ] Support and escalation contacts approved.

### Roster And Roles

- [ ] Exact named-user roster approved.
- [ ] Each immutable principal is verified by Infrastructure.
- [ ] Each user maps to exactly one customer company.
- [ ] Each role is least-privileged and approved.
- [ ] Representatives cannot access Founder-only intelligence or Founder CRM data.
- [ ] Managers cannot impersonate representatives unless separately authorized.
- [ ] No Anthony mapping exists.
- [ ] Reconciled totals remain at or below two companies and 40 users.

### Training And Device Readiness

- [ ] Customer onboarding script completed.
- [ ] Generic PWA installation policy approved.
- [ ] Supported device and browser recorded for each activated user.
- [ ] PWA installation and recovery procedure understood.
- [ ] Route, Directions, result capture, correction, Add Place, Saved Places, End Route, End Day, export, and archive expectations explained.
- [ ] Support-reporting procedure understood.
- [ ] Known limitations acknowledged.

### Safety State

- [ ] Prospective collection is exactly `OFF`.
- [ ] Active prospective cohort count is exactly `0`.
- [ ] Recommendation influence is exactly `OFF`.
- [ ] No representative-facing shadow output exists.
- [ ] One generic PWA is used.
- [ ] No customer-specific code fork exists.

Customer activation result: `PASS` / `FAIL` / `BLOCKED`
Customer decision-maker: ____________________
Prometheus owner: ____________________
Evidence references: ____________________

## Founder Acceptance Script

Cruz alone performs prelaunch human acceptance. No customer user or external person may be used as a prelaunch tester.

### Preconditions

- [ ] Exact candidate commit, tree, deployment identity, and production Worker identities are recorded.
- [ ] Repository and qualification evidence are clean and synchronized.
- [ ] Public and private Worker traffic is at the expected version and percentage.
- [ ] Customer access remains ungranted during prelaunch acceptance.
- [ ] Any acceptance step that would write production data has separate explicit Founder authorization.
- [ ] Default-deny write protection is used for read-only presentation checks.

### Desktop And Mobile Acceptance

- [ ] Open the approved private Route IQ application as Cruz.
- [ ] Verify the Route IQ-only operational experience.
- [ ] Verify exact 390 by 844 mobile layout without horizontal panning or obscured controls.
- [ ] Verify desktop layout at the approved release viewport.
- [ ] Verify the generic PWA installs and opens the correct application.
- [ ] Verify session expiration fails closed and requests fresh authentication.
- [ ] Verify unsupported offline navigation fails closed without creating a write.
- [ ] Verify no Founder intelligence or shadow output is visible to a representative context.

### Workflow Acceptance

- [ ] Fifteen-stop route workflow loads.
- [ ] Continuous route replenishment preserves the intended queue behavior.
- [ ] Business-hours eligibility and closed-business exclusion are visible and correct.
- [ ] Directions is reachable without changing route ordering.
- [ ] Result capture and post-visit corrections are reachable.
- [ ] Add Place immediate outcomes and Saved Places are reachable.
- [ ] Decision Source remains optional and post-action.
- [ ] Discovery Mode, Nearby Context, and off-route learning remain advisory or read-only.
- [ ] Explicit End Route and End Day are reachable.
- [ ] Manual report export and field-session archival behavior are verified through qualified evidence.

### Safety Acceptance

- [ ] Collection remains `OFF` before and after acceptance.
- [ ] Active cohorts remain `0` before and after acceptance.
- [ ] Recommendation influence remains `OFF` before and after acceptance.
- [ ] Anthony remains unmapped.
- [ ] Customer company count remains at or below two.
- [ ] Named customer-user count remains at or below 40.
- [ ] Public Website and Founder CRM protections remain unchanged.

Founder acceptance result: `PASS` / `FAIL` / `BLOCKED`
Accepted by Cruz Garza: ____________________
Acceptance time: ____________________
Evidence references: ____________________

## Launch-Day Production Checklist

### Exact Identity And Release

- [ ] Exact repository commit and tree frozen.
- [ ] Exact qualified artifact and rollback identities recorded.
- [ ] Public Worker version and traffic recorded.
- [ ] Private Worker version and traffic recorded.
- [ ] Existing bindings, secrets by name, migrations, namespaces, routes, and custom domains accounted for.
- [ ] Public/private Worker isolation verified.
- [ ] No archival ref, unqualified build, or local-only artifact is in the release path.

### Operations Readiness

- [ ] All six owner documents in this package are present and current.
- [ ] Monitoring sources and thresholds are available.
- [ ] Incident owner and support owner are named.
- [ ] Forward-compatible rollback artifact is verified but not executed.
- [ ] Customer support and escalation contacts are recorded.
- [ ] Known limitations are acknowledged.
- [ ] Twenty-four-hour and seven-day review owners are scheduled.

### Scope And Safety

- [ ] Zero to two exact customer companies approved.
- [ ] Zero to 40 exact named customer users approved.
- [ ] Every principal, company, role, profile, and territory is unambiguous.
- [ ] One generic PWA only.
- [ ] Collection `OFF`.
- [ ] Cohorts `0`.
- [ ] Recommendation influence `OFF`.
- [ ] Anthony unmapped.
- [ ] No external prelaunch tester used.

### Customer Readiness

- [ ] Each customer activation checklist passes.
- [ ] Each customer onboarding session is complete or scheduled before access begins.
- [ ] Each activated user has a supported device and installation path.
- [ ] Customer decision-maker has authorized the exact activation scope.
- [ ] No customer requested an unauthorized data, intelligence, or access expansion.

## Launch-Day Go/No-Go

The only allowed decision values are `GO`, `NO-GO`, and `DEFERRED`.

Return `NO-GO` when any of the following is true:

- An exact release, Worker, artifact, binding, migration, or rollback identity is unknown or mismatched.
- Founder acceptance is not `PASS`.
- Any customer activation checklist is not `PASS`.
- Company or user counts are unknown, mismatched, or above the ceiling.
- Any safety state differs from `OFF`, `0`, `OFF`.
- Anthony is mapped.
- Cross-company, cross-user, role, Founder-endpoint, or data-isolation behavior is uncertain.
- A required monitor, alert source, support owner, incident owner, or rollback artifact is unavailable.
- Customer authorization, permitted-data boundary, retention disclosure, or support contact is missing.
- A Critical or unresolved High launch issue remains.
- A production mutation would be required without exact Founder authorization.

`GO` authorizes only the exact companies, roster, date, and access actions named in the Founder decision. It does not authorize deployment, new companies, extra users, collection, cohorts, recommendation influence, Anthony mapping, production-data repair, or customer outreach beyond that decision.

```text
Decision: GO / NO-GO / DEFERRED
Exact company count: ____ / 2
Exact named-user count: ____ / 40
Founder acceptance: PASS / FAIL / BLOCKED
Customer activation evidence: ____________________
Monitoring owner: ____________________
Support owner: ____________________
Rollback evidence: ____________________
Open Critical issues: ____
Open High issues: ____
Founder decision by Cruz Garza: ____________________
Decision time: ____________________
```

## Activation Sequence

After an exact `GO` decision:

1. Reconfirm the company and user counts immediately before access work.
2. Provision only the exact named principals authorized by the Founder.
3. Verify each principal's company, operating profile, role, and territory in isolation.
4. Activate users in a controlled order chosen by the Founder; do not activate all users implicitly.
5. Confirm the generic PWA opens the correct workspace and least-privileged role.
6. Confirm collection `OFF`, cohorts `0`, and recommendation influence `OFF` after each activation group.
7. Record support readiness and monitoring state.
8. Stop on the first identity, isolation, data-integrity, or safety-state discrepancy.

The activation sequence does not authorize a deployment or production-data correction. Those require separate Founder authorization.

## First 24 Hours

Perform checks at activation, approximately 1 hour, 4 hours, and 24 hours. Low activity does not permit inventing evidence.

- [ ] Public and private Worker identities and traffic remain expected.
- [ ] Customer company count remains at or below two.
- [ ] Named customer-user count remains at or below 40.
- [ ] No duplicate or cross-company principal mapping exists.
- [ ] Authentication succeeds only for approved principals and fails closed otherwise.
- [ ] Representatives remain least-privileged.
- [ ] No Founder CRM or Founder intelligence access is available to customer users.
- [ ] Route startup, route queue, Directions, result capture, correction, export, and archival support show no Critical failure.
- [ ] No lost or duplicate accepted record is reported.
- [ ] Collection remains `OFF`; prospective coordinator requests and writes remain zero.
- [ ] Active cohorts remain `0`.
- [ ] Recommendation influence remains `OFF`.
- [ ] PWA version, session-expiration, and update behavior remain safe.
- [ ] Worker errors, latency, Access denials, Durable Object activity, and support issues remain below the Infrastructure thresholds.
- [ ] Every incident or user report is recorded through production support triage.
- [ ] No unapproved customer, user, feature, integration, or data category was added.

Twenty-four-hour result: `PASS` / `FAIL` / `BLOCKED`
Reviewer: ____________________
Evidence: ____________________

## First Seven Days

- [ ] Repeat every 24-hour safety and identity check using the exact current production identities.
- [ ] Review activation and removal records for roster drift.
- [ ] Review company, operating-profile, territory, role, and user isolation evidence.
- [ ] Review accepted-record integrity, duplicate/conflict evidence, archive finality, and export availability.
- [ ] Review authentication failures and session-expiration incidents.
- [ ] Review startup and workflow latency against thresholds.
- [ ] Review PWA installation, update, reinstall, and device-specific issues.
- [ ] Review support volume by severity and owning subsystem.
- [ ] Confirm no Critical issue and no unresolved High issue threatens continued operation.
- [ ] Reconfirm collection `OFF`, cohorts `0`, recommendation influence `OFF`, and Anthony unmapped.
- [ ] Compare observed usage only with the approved success measurements; make no causal or superiority claim.
- [ ] Confirm retention and legal-hold handling remain inside the disclosed policy.
- [ ] Record customer feedback as support evidence or a feature request, not as automatic engineering authorization.
- [ ] Founder decides: continue exact scope, narrow, pause, or stop.

Seven-day result: `CONTINUE` / `NARROW` / `PAUSE` / `STOP`
Founder decision: ____________________
Customer review completed: Yes / No
Evidence: ____________________

## Final Boundary

This package prepares and controls operations. It does not itself:

- deploy either Worker;
- grant or revoke access;
- create a customer workspace;
- create or modify production data;
- contact a customer;
- submit a CRM request;
- send a notification;
- authorize Anthony;
- activate collection, cohorts, or recommendation influence;
- approve a third company or forty-first named customer user.

Every such action requires its owning subsystem's verified evidence and the exact Founder or customer decision identified above.
