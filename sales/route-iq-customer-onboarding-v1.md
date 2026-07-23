# Route IQ Customer Onboarding v1

Document ID: `route-iq-customer-onboarding-v1`
Owner: Prometheus Sales / Customer Success
Status: production customer onboarding script
Scope: bounded August 1 activation

## Purpose

This script prepares an approved customer and its named users to operate Route IQ in production. It is not a beta script, sales claim, access grant, deployment authorization, or substitute for customer and Founder approval.

## Onboarding Preconditions

- Customer company is one of no more than two Founder-approved companies.
- Every attendee is on the exact approved roster.
- Total named customer users remain at or below 40.
- Customer decision-maker has authorized production activation.
- Founder has authorized the exact activation scope.
- Workspace, operating profile, territory, locations, roles, and success measurements are approved.
- Customer has received the retention and permitted-data disclosure.
- Support channel and escalation contacts are named.
- Infrastructure has verified or scheduled immutable-principal mapping.
- Anthony remains unmapped.
- Collection is `OFF`, cohorts are `0`, and recommendation influence is `OFF`.

Do not conduct production onboarding as a way to gather customer authorization that should already exist.

## Required Customer Decisions

The customer decision-maker confirms:

- company identity and authorized operating scope;
- exact user roster and manager/representative roles;
- territory and location assignments;
- permitted and prohibited information;
- device ownership and PWA installation policy;
- success measurements and review cadence;
- support and escalation contacts;
- retention disclosure and any requested period shorter than 18 months;
- activation date, review date, and stop conditions.

The customer cannot authorize a third company, forty-first user, cross-company access, Founder intelligence, Anthony access, collection, cohorts, recommendation influence, a new data category, or a customer-specific code fork.

## Required Founder Decisions

The Founder confirms:

- exact customer and roster admission;
- exact user roles and immutable-principal mapping handoff;
- production activation date and order;
- support owner and coverage window;
- success-measurement interpretation;
- final go/no-go;
- any production deployment, access mutation, record correction, rollback, notification retry, or scope expansion.

No onboarding facilitator may infer a Founder decision from a calendar invitation, customer request, sales note, or prior beta record.

## Facilitator Script

### 1. Open With The Product Boundary

Say:

> Prometheus is the company. Route IQ is the production field-operations product. It helps field teams structure routes, visits, territory context, customer context, and outcomes into governed evidence and decision-ready intelligence. People remain responsible for every field and business decision.

Then state:

- Route IQ is not a route planner, CRM, mapping replacement, or generic AI assistant.
- Existing evidence does not prove causal uplift or recommendation superiority.
- Prospective collection is `OFF`.
- Active cohorts are `0`.
- Recommendation influence is `OFF`.
- Current advisory and learning features do not automatically change representative routes.

### 2. Explain The Customer Configuration

Review only the approved configuration:

- company and workspace;
- operating profile;
- territory and locations;
- user roles;
- visit and outcome terminology;
- business goals and success measurements;
- retention period;
- support contacts.

Do not discuss another customer's workspace, users, evidence, configuration, or results.

### 3. Explain Representative Workflow

Representatives should understand how to:

- open the generic Route IQ PWA;
- confirm the correct workspace and role;
- review the route queue;
- use Directions;
- record a result after the action;
- make an allowed post-visit correction;
- use Add Place and Saved Places;
- use optional Decision Source only as post-action context;
- understand Discovery Mode and Nearby Context as advisory;
- use explicit End Route and End Day;
- produce an approved manual report export;
- report an error or ambiguous write without retrying blindly.

Representatives must not receive Founder CRM, Founder intelligence, readiness reports, shadow rankings, probabilities, confidence, or administrative controls.

### 4. Explain Manager Workflow

Managers should understand:

- their exact approved visibility;
- that they may not impersonate a representative unless separately authorized;
- how to review approved activity and outcome measures;
- how to distinguish evidence from inference;
- how to avoid using Route IQ as continuous surveillance;
- how to report role, roster, territory, or data-isolation concerns;
- that feature requests do not authorize immediate product changes.

### 5. Explain Data Boundaries

- Enter only customer-approved field-operation information.
- Do not enter passwords, payment information, authentication codes, secrets, unrestricted raw notes, or unnecessary personal information.
- Location evidence is contextual evidence, not absolute proof.
- Historical evidence is append-only and is not silently rewritten.
- The maximum raw field-session retention is 18 months; an authorized customer contract may shorten it but may not expand it without separate Founder approval.
- Legal hold may pause disposition according to the governed policy.
- Cross-company and cross-user access is prohibited.

### 6. Install The Generic PWA

Use `docs/route-iq-pwa-installation-and-recovery-v1.md`.

- Install only from the approved canonical URL.
- Use the current governed generic application.
- Do not create a customer-specific clone or bookmark to an alternate hostname.
- Verify the correct workspace and least-privileged role.
- Explain secure-connection, session-expiration, update, and recovery behavior.

### 7. Explain Support

Use the Founder-approved support channel and `administration/workflows/route-iq-production-support-triage-v1.md`.

Users should report:

- what they were trying to do;
- expected and observed behavior;
- device/browser class;
- safe reproduction steps;
- whether work is blocked;
- whether a write result is ambiguous.

Users must not send passwords, codes, tokens, cookies, screenshots containing protected customer data, or another user's information.

### 8. Confirm Known Limitations

Review `docs/route-iq-production-known-limitations-v1.md`. Do not soften or omit a limitation to complete onboarding.

### 9. Confirm Understanding

Ask each user to explain:

- which workspace and role they should see;
- what they may record;
- what they must not record;
- what to do after an ambiguous write;
- how to contact support;
- what Route IQ does not automate;
- why they must not share their session or one-time code.

A production practice record may be created only with separate Founder and customer authorization identifying the exact record type and cleanup or retention treatment. Onboarding alone does not authorize a write.

## Onboarding Completion Checklist

- [ ] Customer decisions recorded.
- [ ] Founder decisions recorded.
- [ ] Company and user counts reconciled.
- [ ] Every attendee is an approved named user or customer decision-maker.
- [ ] Product and intelligence boundaries explained.
- [ ] Workspace, operating profile, territory, role, and terminology reviewed.
- [ ] Representative or manager workflow reviewed as applicable.
- [ ] Permitted and prohibited data reviewed.
- [ ] Retention and legal-hold disclosure reviewed.
- [ ] Generic PWA installed or scheduled.
- [ ] Support channel and escalation path reviewed.
- [ ] Known limitations acknowledged.
- [ ] No production practice write occurred without separate authorization.
- [ ] Collection remains `OFF`, cohorts remain `0`, recommendation influence remains `OFF`.
- [ ] Anthony remains unmapped.

Customer company: ____________________
Customer decision-maker: ____________________
Named users covered: ____
Customer acknowledgment: ____________________
Prometheus facilitator: ____________________
Completion date: ____________________
Activation blockers: ____________________

## Post-Onboarding Boundary

Completion means the approved people understand the approved scope. It does not automatically:

- grant access;
- activate a user or company;
- approve a deployment;
- submit a record;
- send a notification;
- expand retention;
- change a role or territory;
- enable collection, cohorts, or recommendation influence;
- authorize Anthony;
- promise a feature, result, SLA, or business outcome.
